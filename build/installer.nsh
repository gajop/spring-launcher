!macro customInstall
  IfFileExists `$INSTDIR\data\*.*` file_found file_not_found
  file_not_found:
    CreateDirectory "$INSTDIR\data"
    AccessControl::GrantOnFile \
        "$INSTDIR\data" "(BU)" "GenericRead + GenericWrite"
    Pop $0
  file_found:
!macroend

!macro customRemoveFiles
  ${ifNot} ${isUpdated}
    pushd "$INSTDIR\data" && rd /s /q "$INSTDIR" 2>nul
  ${endif}
!macroend