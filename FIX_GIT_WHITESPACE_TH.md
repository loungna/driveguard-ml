# DriveGuard React v1.6 — แก้ git whitespace verification (exit 2)

## สาเหตุ

ไฟล์ในแพ็กเกจเดิมบางไฟล์เป็น CRLF แบบ Windows เช่น `.bat` และ JSON จากโมเดล ส่วน `tests/test_inference.py` มีบรรทัดว่างเกินที่ท้ายไฟล์ `git diff --cached --check` ของ Git บางการตั้งค่าจึงส่ง exit code 2 และสคริปต์หยุดก่อน Commit

## วิธีแก้ที่แนะนำ (ไม่ต้องติดตั้ง GitHub Login ใหม่)

1. แตกไฟล์ ZIP แก้ไขเต็มชุดลง **โฟลเดอร์ใหม่**
2. เปิด `SETUP_AUTO_GITHUB_VERCEL_CLICK_HERE.bat` ในโฟลเดอร์ใหม่นั้น
3. ใช้บัญชี GitHub เดิมที่คุณล็อกอินผ่าน `gh auth login` แล้ว (การ Login จะยังอยู่)

ถ้าต้องการใช้งานใน **โฟลเดอร์เดิมที่เคยเริ่ม Git ไว้** ให้ใช้ไฟล์ ZIP Patch แยก แล้วคัดลอกทับ 3 ไฟล์ตามตำแหน่งเดิม:

- `SETUP_AUTO_GITHUB_VERCEL.ps1`
- `SYNC_CODE_TO_GITHUB.ps1`
- `tests/test_inference.py`

จากนั้นรัน `SETUP_AUTO_GITHUB_VERCEL_CLICK_HERE.bat` อีกครั้ง

## ทดสอบก่อน Push ด้วยตัวเอง

```powershell
git add -A
git -c core.whitespace=cr-at-eol diff --cached --check
if ($LASTEXITCODE -eq 0) { Write-Host 'Git whitespace check: PASS' }
```

คำสั่ง `core.whitespace=cr-at-eol` ยอมรับการจบบรรทัด CRLF แต่ยังคงตรวจช่องว่างท้ายบรรทัดและข้อผิดพลาดจริงตามเดิม ไม่ได้ปิดการตรวจทั้งหมด

หากยังเกิด Error ให้ส่งข้อความที่อยู่ **เหนือ** `verification failed` มาด้วย เพราะ Git จะแสดงชื่อไฟล์และเลขบรรทัดที่เหลืออยู่

## ความปลอดภัย

โฟลเดอร์ `.venv/`, `node_modules/`, `dist/`, `.vercel/` และไฟล์ `CrystalDiskInfo_*.txt` ถูกใส่ใน `.gitignore` แล้ว อย่า Commit ไฟล์ Serial Number หรือ token ลง Repository สาธารณะ

## ข้อจำกัด

ตรวจด้วย Git ในสภาพแวดล้อม Linux ว่าการ Stage ไฟล์และเรียก `diff --cached --check` ผ่าน ไม่ได้รัน PowerShell บน Windows ของผู้ใช้จริง
