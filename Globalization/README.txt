LGSS Manager — Custom Language Drop-in Folder
==============================================

Drop community-translated .xaml files here. The Manager will
scan this folder on startup and whenever you click "Reload
Languages" in the language picker.

Workflow:
  1. Open the Manager and pick the language icon (top-right).
  2. Click "EN · Template" to download `en.xaml`.
  3. Open it in Notepad/VS Code, translate every <sys:String>
     body into your language.
  4. Rename to your ISO language code (e.g. `pl.xaml`, `ja.xaml`).
  5. Drop the file in THIS folder.
  6. Click "Reload Languages" — your language appears in the
     picker right next to the built-ins.

Once you are happy with the translation, send the .xaml file to
LGSS so we can bundle it in the next release for everyone.
