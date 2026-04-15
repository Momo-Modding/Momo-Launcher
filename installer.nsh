!macro customHeader
  RequestExecutionLevel user
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
  StrCpy $isForceMachineInstall "0"
!macroend

!macro customInit
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 == "Admin"
    MessageBox MB_ICONSTOP "This launcher must be installed as a standard user. Please do not run as Administrator."
    Quit
  ${EndIf}
!macroend
