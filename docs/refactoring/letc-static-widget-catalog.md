# LETC Static Widget Catalog

This is the durable Phase 2.6 corrective inventory of every public builder
exported by sources/ui-core/letc/toolkit/skeletons.js at source SHA
ea007c63fe1676f75e2cf9e3490a467987eae298. The source declares Menu twice;
JavaScript leaves one public property, so there are 27 public paths.

target/foundation/ui-runtime/src/skeletons.js is a selective CommonJS
adaptation of the actual toolkit/core.js, toolkit/builder.js and builder
classes. It uses literal historical kind strings, never KIND.*. Every
KEEP_KERNEL entry is in retainedSkeletonCatalog, registered before READY, and
resolves to the listed extracted Marionette Widget class.

| Skeleton path | Historical builder | Emitted kind | Genuine Widget / source chain | Classification | Corrective decision and KIND adaptation |
|---|---|---|---|---|---|
| Avatar | toolkit/skeleton/avatar.js | note | builder/avatar.js → widgets/text/index.js → LetcText | KEEP_KERNEL | Retained; historical literal is note. |
| Box.G | skeleton/box-g.js | box | toolkit/core,builder → widgets/box/index.js → LetcBox | KEEP_KERNEL | Retained; flow g. |
| Box.X | skeleton/box-x.js | box | same | KEEP_KERNEL | Retained; flow x. |
| Box.Y | skeleton/box-y.js | box | same | KEEP_KERNEL | Retained; flow y. |
| Box.Z | skeleton/box-z.js | box | same | KEEP_KERNEL | Retained; historical _a.none becomes none. |
| Button.Icon | skeleton/button/icon.js | image_svg | builder/button/icon.js → widgets/image/svg/index.js → LetcSvgImage | KEEP_KERNEL | KIND.image.svg → image_svg. |
| Button.Label | skeleton/button/label.js | image_svg | builder/button/label.js → LetcSvgImage | KEEP_KERNEL | KIND.image.svg → image_svg. |
| Button.Svg | skeleton/button/svg.js | image_svg | builder/button/svg.js → LetcSvgImage | KEEP_KERNEL | KIND.image.svg → image_svg. |
| Element | skeleton/element.js | wrapper | toolkit/builder.js → widgets/blank/index.js → LetcBlank | KEEP_KERNEL | Literal wrapper; no pseudo-constant. |
| Entry | skeleton/entry/input.js | entry | widgets/entry/input/index.js → LetcEntry | KEEP_KERNEL | _a.off → off. |
| EntryBox | skeleton/entry/reminder.js | entry_reminder | widgets/entry/reminder/index.js → LetcEntryReminder → LetcEntry | KEEP_KERNEL | Reinstated generic composed input/validation shell; Team service dispatch is excluded. KIND.entry_reminder → entry_reminder. |
| FileSelector | skeleton/file-selector.js | fileselector | widgets/file-selector/index.js → LetcFileSelector | KEEP_KERNEL | Generic browser file-input boundary; no MFS storage operation. |
| Image.Smart | skeleton/image/smart.js | image_smart | widgets/image/smart/index.js → LetcImageSmart | KEEP_KERNEL | Reinstated generic src/low/high browser image lifecycle; nid/actualNode MFS path removed. KIND.image.smart → image_smart. |
| Image.Svg | skeleton/image/svg.js | image_svg | widgets/image/svg/index.js → LetcSvgImage | KEEP_KERNEL | KIND.image.svg → image_svg; generic inline SVG only. |
| List.Scroll | skeleton/list/smart.js | list_smart | builder/list/smart.js → widgets/list/index.js,smart/index.js → LetcList | KEEP_KERNEL | Retained with real LetcBox collection ancestry. |
| List.Smart | skeleton/list/smart.js | list_smart | same | KEEP_KERNEL | Retained. |
| List.Table | skeleton/list/table.js | list_table | builder/list/table.js → widgets/list/index.js,table/index.js → LetcTable | KEEP_KERNEL | Retained as distinct LetcTable, not alias to smart list. |
| Menu | skeleton/menu.js | menu_topic | widgets/menu/index.js → LetcMenuTopic → LetcBox | KEEP_KERNEL | Reinstated generic menu state; Team router/radio/desktop geometry removed. |
| Messenger | skeleton/messenger.js | messenger | ui-team/src/drumee/builtins/messenger/index.js | DEFER_TEAM | Final exclusion: Team chat API, attachment/MFS workflow, emoji assets and Team state are intrinsic. KIND.messenger → messenger only as documentation. |
| Note | skeleton/note.js | note | widgets/text/index.js → LetcText | KEEP_KERNEL | Retained and browser-proven. |
| Profile | skeleton/profile.js | profile | widgets/profile/index.js | DEFER_MFS | Final exclusion: calls Visitor.avatar plus Team presence/Wm state. Repository location is not the reason. |
| Progress | skeleton/progress.js | progress | widgets/progress/media/index.js | DEFER_MFS | Final exclusion: required loader/client/upload-transfer lifecycle is MFS/media work. |
| RichText | skeleton/rich-text.js | rich_text | widgets/text/editable/index.js → LetcRichText | KEEP_KERNEL | Reinstated generic contenteditable lifecycle; MFS paste-file and app service policy removed. KIND.rich_text → rich_text. |
| Textarea | skeleton/entry/textarea.js | entry | widgets/entry/input/index.js → LetcEntry | KEEP_KERNEL | KIND.entry → entry; type is textarea. |
| UserProfile | skeleton/profile.js | profile | same as Profile | DEFER_MFS | Alias of Profile; same final reason. |
| Wrapper.X | skeleton/wrapper-x.js | box | toolkit/builder.js → widgets/box/index.js → LetcBox | KEEP_KERNEL | Retained with dialog__wrapper, name and sys_pn. |
| Wrapper.Y | skeleton/wrapper-y.js | box | same | KEEP_KERNEL | Retained. |

## Static Kind closure

The 23 retained public builders emit 12 strings, each registered before READY.

| Kind | Real extracted class | Historical source |
|---|---|---|
| box | LetcBox (Marionette.CollectionView) | widgets/box/index.js |
| entry | LetcEntry (LetcBox) | widgets/entry/input/index.js |
| entry_reminder | LetcEntryReminder (LetcBox) | widgets/entry/reminder/index.js |
| fileselector | LetcFileSelector (Marionette.View) | widgets/file-selector/index.js |
| image_smart | LetcImageSmart (Marionette.View) | widgets/image/smart/index.js |
| image_svg | LetcSvgImage (Marionette.View) | widgets/image/svg/index.js |
| list_smart | LetcList (LetcBox) | widgets/list/index.js,smart/index.js |
| list_table | LetcTable (LetcList) | widgets/list/index.js,table/index.js |
| menu_topic | LetcMenuTopic (LetcBox) | widgets/menu/index.js |
| note | LetcText (Marionette.View) | widgets/text/index.js |
| rich_text | LetcRichText (LetcText) | widgets/text/editable/index.js |
| wrapper | LetcBlank (Marionette.View) | widgets/blank/index.js |

The exhaustive test invokes every retained builder and verifies its literal
kind, static registration and Marionette lineage. The Chrome test proves the
path Skeletons.Note → note → LetcText → DOM; the canonical ui-dev-tools Widget
fixture separately proves LetcBox → onDomRefresh → feed with a skin.
