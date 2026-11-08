import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const gradle = 'mobile/src-tauri/gen/android/app/build.gradle.kts';
if (!existsSync(gradle)) throw new Error('Run tauri android init first');
let s = readFileSync(gradle, 'utf8');
s = s.replace(/compileSdk\s*=\s*\d+/, 'compileSdk = 36').replace(/targetSdk\s*=\s*\d+/, 'targetSdk = 36');
if (!s.includes('useLegacyPackaging')) s = s.replace(/android\s*\{/, 'android {\n    packaging { jniLibs { useLegacyPackaging = false } }');
if (!s.includes('ndkVersion')) s = s.replace(/compileSdk = 36/, 'compileSdk = 36\n    ndkVersion = "28.2.13676358"');
writeFileSync(gradle, s);
console.log('Android Gradle configured: compile/target SDK 36, NDK r28, uncompressed JNI libs');
