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
  ${if} ${isUpdated}
    DetailPrint "Updating..."
    FindFirst $0 $1 $INSTDIR
    loop:
      StrCmp $1 "" done

      StrCmp $1 "data" skip delete
      delete:
      RMDir /r $1
      skip:

      FindNext $0 $1
      Goto loop
    done:
    FindClose $0
  ${else}
    DetailPrint "Uninstalling..."
    RMDir /r $INSTDIR
  ${endif}
!macroend