# แก้ปัญหา No module named uvicorn

แพ็กเกจ v1.6 React รุ่นแรกตกหล่น Uvicorn ใน requirements.txt ไฟล์ ZIP นี้แก้ไขแล้ว

## ติดตั้ง (Windows PowerShell)

เปิด PowerShell ในโฟลเดอร์โปรเจกต์ แล้วรัน:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.index:app --reload --port 8000
```

ตรวจ http://127.0.0.1:8000/api/health

หากมี .venv อยู่แล้ว ไม่จำเป็นต้องสร้างใหม่ สามารถติดตั้งได้ด้วย:

```powershell
.\.venv\Scripts\python.exe -m pip install 'uvicorn[standard]'
```

เปิด terminal ที่สอง รัน `npm install` แล้ว `npm run dev`

ใช้ `.venv\Scripts\python.exe` กับคำสั่ง pip/uvicorn ตัวเดียวกันเพื่อไม่ให้ติดตั้งคนละ interpreter
