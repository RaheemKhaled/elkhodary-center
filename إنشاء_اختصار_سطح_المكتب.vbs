Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
strCurrentDir = WshShell.CurrentDirectory

Set oShortcut = WshShell.CreateShortcut(strDesktop & "\المركز - إدارة صيانة السيارات.lnk")
oShortcut.TargetPath = "wscript.exe"
oShortcut.Arguments = chr(34) & strCurrentDir & "\تشغيل_المركز_صامت.vbs" & chr(34)
oShortcut.WorkingDirectory = strCurrentDir
oShortcut.Description = "نظام إدارة مركز صيانة السيارات وضبط الزوايا والعفشة"
oShortcut.WindowStyle = 1
oShortcut.Save
WScript.Echo "Shortcut created successfully."
