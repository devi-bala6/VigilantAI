# 🛡️ VigilantAI – Intelligent Scam Prevention & Cyber Fraud Analyzer

**VigilantAI** is a multi-modal fraud detection system designed for rapid scam identification across Text, Voice, URL, Image OCR, and Behavioral Finance Patterns.

Built specifically for hackathons and demonstrations, it uses lightweight heuristics, NLP-based rules, and browser-side OCR to deliver real-time risk scoring without the need for heavy machine learning model deployment.

---

## 🚀 Features

### 🔤 1. Text Scam Detection
* Detects high-risk scam keywords (e.g., *OTP, urgent, verify, lottery, bank, transfer*).
* Scores risk from **0–100**.
* **Outputs:** 🟢 LIKELY REAL | 🔶 UNSAFE | 🔥 POTENTIAL FRAUD.
* Provides a breakdown of reasons for the flag.

### 🎙️ 2. Voice Transcript Detection
* Utilizes the **Browser Speech Recognition API (Chrome)**.
* Converts live speech to text and runs it through the fraud scoring engine.
* *Ideal for detecting fake bank calls, vishing, and OTP scams.*

### 🖼️ 3. Image / Document OCR Analysis
* Client-side OCR using **Tesseract.js**.
* Scans screenshots, invoices, and payment requests.
* Extracts text from images and analyzes it for fraud indicators.

### 🔗 4. URL Scam Detection
* **Detects:**
    * Missing HTTPS security.
    * Suspicious Top-Level Domains (TLDs).
    * Login/verification patterns in the URL path.
    * High-risk IP-based domains.
* Outputs a clear risk level with reasons.

### 📊 5. Behavioral Transaction Analysis
* Uploads a CSV file of transactions.
* **Flags:**
    * Sudden large transfers.
    * Unusual receivers.
    * High-frequency payments.
    * Outlier anomalies.

---

## 🧠 Risk Classification Logic

The system assigns a score to every analysis. Based on that score, a verdict is generated:

| Score | Verdict | Status |
| :--- | :--- | :--- |
| **0–19** | ✅ LIKELY REAL | 🛡️ SAFE TO PROCEED |
| **20–49** | 🔶 UNSAFE | ⚠️ PROCEED WITH CAUTION |
| **50+** | 🚨 POTENTIAL FRAUD | ❌ DO NOT PROCEED |

---

## 📂 Project Structure

```bash
scam-detector/
│── server.js           # Backend logic (Node/Express)
│── package.json        # Dependencies
│── uploads/            # Temp storage for file analysis
│── public/             # Frontend files
│   ├── index.html      # Main User Interface
│   ├── styles.css      # Styling
│   └── app.js          # Client-side logic & API calls
└── README.md           # Documentation
⚙️ Installation & Setup
1️⃣ Install Dependencies
Open your Command Prompt (cmd) or Terminal, navigate to the project folder, and run:

Bash

cd C:\scam-detector
npm install
2️⃣ Run Server
Start the backend server:

Bash

node server.js
You should see the message: Server listening on http://localhost:3000

3️⃣ Open UI in Browser
Open Google Chrome (recommended for Voice API) and go to: 👉 http://localhost:3000

⚠️ IMPORTANT: Do NOT open the index.html file directly (e.g., file:///C:/...). The backend API will not connect. You must use localhost:3000.

🧪 Testing Examples (For Demo)
Use these inputs to demonstrate the detection capabilities:

🔤 Text Test (Result: POTENTIAL FRAUD)
"You have won a lottery of $50,000! Please share your UPI and bank details to claim the prize."

🔗 URL Test (Result: UNSAFE)
http://82.123.44.12/login-verify

🎙️ Voice Test (Speak Clearly)
"This is from your bank. Share your OTP immediately or your account will be blocked."

🖼️ OCR Image Test
Upload a screenshot containing text like:

"Verify your bank OTP to continue your account update."

📊 Behavioral Test (CSV)
Create a .csv file with the data below to test "Outlier Detection":

Code snippet

date,fromAccount,toAccount,amount
2023-10-10,123,555,200
2023-10-11,123,666,180
2023-10-12,123,777,150
2023-10-13,123,888,99000
(The system will flag the 99,000 transaction as a high-risk outlier)

🎯 Why VigilantAI?
Multi-modal analysis: Covers Text, Audio, Visual, and Behavioral vectors in one system.

Lightweight: Runs instantly without heavy ML model dependencies.

Hackathon Ready: Clean UI, transparent scoring, and easy to demonstrate.

Scalable: Designed to be extended with BERT, LSTM, or Whisper models in the future.

👥 Credits
Developed for National Hackathon 2025 — Cyber Security Domain
