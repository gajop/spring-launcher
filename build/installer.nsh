!macro customInstall
  IfFileExists `$INSTDIR\data\*.*` file_found file_not_found
  file_not_found:
    CreateDirectory "$INSTDIR\data"
    AccessControl::GrantOnFile \
        "$INSTDIR\data" "(BU)" "GenericRead + GenericWrite"
    Pop $0
  file_found:
!macroend