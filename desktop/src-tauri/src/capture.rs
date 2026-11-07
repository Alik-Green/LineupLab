//! Small, isolated Win32 adapter. No process memory, hooks, DLL injection or game handles.
use lineuplab_core::{capture::CaptureProvider, Error, Result};
use windows_sys::core::BOOL;
use windows_sys::Win32::Foundation::{LPARAM, RECT};
use windows_sys::Win32::Graphics::Gdi::{MonitorFromWindow, MONITOR_DEFAULTTONEAREST};
use windows_sys::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowTextW, GetWindowRect};
pub struct XcapCapture { monitor_index: usize }
pub fn system_provider() -> Result<Box<dyn CaptureProvider>> {
    let center = find_valorant_monitor_center();
    let monitors = xcap::Monitor::all().map_err(|e| Error::Invalid(e.to_string()))?;
    let index = center.and_then(|p| monitors.iter().position(|m| match (m.x(), m.y(), m.width(), m.height()) { (Ok(x), Ok(y), Ok(w), Ok(h)) => p.0 >= x && p.0 < x + w as i32 && p.1 >= y && p.1 < y + h as i32, _ => false })).unwrap_or(0);
    Ok(Box::new(XcapCapture { monitor_index:index }))
}
impl CaptureProvider for XcapCapture {
    fn capture(&mut self) -> Result<Vec<u8>> {
        let monitors=xcap::Monitor::all().map_err(|e| Error::Invalid(e.to_string()))?;
        let m=monitors.get(self.monitor_index).ok_or_else(|| Error::NotFound("Capture monitor".into()))?;
        let image=m.capture_image().map_err(|e| Error::Invalid(e.to_string()))?;
        let mut bytes=std::io::Cursor::new(vec![]); image.write_to(&mut bytes,image::ImageFormat::Png)?; Ok(bytes.into_inner())
    }
    fn monitor_name(&self) -> String { format!("Monitor {}",self.monitor_index+1) }
}
/// Title inspection is deliberately the ONLY game-specific logic.
fn find_valorant_monitor_center() -> Option<(i32,i32)> {
    struct Search { center:Option<(i32,i32)> }
    unsafe extern "system" fn callback(hwnd:windows_sys::Win32::Foundation::HWND,lparam:LPARAM) -> BOOL {
        let search=&mut *(lparam as *mut Search); let mut title=[0u16;512];
        let len=GetWindowTextW(hwnd,title.as_mut_ptr(),title.len() as i32); if len<=0 { return 1; }
        let title=String::from_utf16_lossy(&title[..len as usize]);
        if title=="VALORANT" || title.starts_with("VALORANT  ") {
            let mut r:RECT=unsafe { std::mem::zeroed() };
            if unsafe { GetWindowRect(hwnd,&mut r) }!=0 { search.center=Some(((r.left+r.right)/2,(r.top+r.bottom)/2)); let _=unsafe { MonitorFromWindow(hwnd,MONITOR_DEFAULTTONEAREST) }; return 0; }
        }
        1
    }
    let mut search=Search { center:None }; unsafe { EnumWindows(Some(callback),&mut search as *mut Search as LPARAM); } search.center
}
/// WDA_EXCLUDEFROMCAPTURE requires Windows 10 2004+. Failure blocks capture.
pub fn exclude_from_capture(hwnd:isize) -> Result<()> {
    use windows_sys::Win32::UI::WindowsAndMessaging::SetWindowDisplayAffinity;
    const WDA_EXCLUDEFROMCAPTURE:u32=0x00000011;
    if unsafe { SetWindowDisplayAffinity(hwnd as *mut _,WDA_EXCLUDEFROMCAPTURE) }==0 { return Err(Error::Unsupported("Capture exclusion requires Windows 10 2004+. Capture is blocked until exclusion succeeds.".into())); }
    Ok(())
}
