; =============================================================================
; LGSS SCUM Server Manager — NSIS Windows x64 Prerequisite Check Macros
; Copyright (c) 2026 Legendary Gaming (4UR3X).
; Reference NSIS header demonstrating 64-bit OS & VC++ Redistributable checks.
; =============================================================================

!include "x64.nsh"
!include "LogicLib.nsh"

!macro LGSS_VERIFY_WINDOWS_X64
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP|MB_OK "LGSS SCUM Server Manager requires a 64-bit edition of Windows 10, Windows 11, or Windows Server 2019+."
    Abort
  ${EndIf}
  SetRegView 64
!macroend

!macro LGSS_ENSURE_VCREDIST_X64 BundledRedistPath
  SetRegView 64
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ReadRegDWORD $1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Bld"
  ${If} $0 != 1
  ${OrIf} $1 < 30000
    IfFileExists "${BundledRedistPath}" 0 +3
      DetailPrint "Installing Microsoft Visual C++ 2015-2022 Redistributable (x64)..."
      ExecWait '"${BundledRedistPath}" /install /quiet /norestart' $2
  ${EndIf}
!macroend

!macro LGSS_REGISTER_FIREWALL_PORT RuleName Protocol PortNumber
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${RuleName}" dir=in action=allow protocol=${Protocol} localport=${PortNumber}'
!macroend
; LGSS Platform Release v1.3.35
