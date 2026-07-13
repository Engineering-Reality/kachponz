Jalankan loop disposable email -> login -> OTP -> survey sebanyak 3 kali
04:24 PM
Agent Call Execution
04:24 PM
Invoking MCP Tool
trigger_uipath_job
Parameters
{"releaseKey":"Get_DisposableEmail_1","folderId":"999269"}
Agent Call Execution
04:24 PM
Invoking MCP Tool
list_uipath_processes
Parameters
{"folderId":"999269"}
Agent Call Execution
04:24 PM
Invoking MCP Tool
trigger_uipath_job
Parameters
{"releaseKey":"Get_DisposableEmail_1","folderId":"999269"}
Agent Call Execution
04:24 PM
Invoking MCP Tool
trigger_uipath_job
Parameters
{"releaseKey":"Get_DisposableEmail_2","folderId":"999269"}
Amadeus
Error "Undefined process" juga terjadi untuk Get_DisposableEmail_2.

Ini menunjukkan masalah sistemik — kemungkinan besar semua proses di folder ini sedang tidak dapat dijalankan (misalnya karena masalah publish, lisensi robot, atau konfigurasi folder).

Karena tidak ada proses disposable email yang bisa di-trigger, saya tidak dapat memulai loop sama sekali.

Rekomendasi:

Periksa status Publish dan Enable semua proses di folder UiPath (999269).
Pastikan ada robot tersedia yang terhubung ke folder ini.
Jika masalah berlanjut, hubungi admin UiPath untuk investigasi lebih lanjut.
Saya hentikan proses di sini karena tidak ada tool yang bisa mengatasi error infrastruktur ini.
