# LETC Static Widget Catalog

This is the durable Phase 2.6 inventory of the public API exported by
`sources/ui-core/letc/toolkit/skeletons.js` at source SHA
`ea007c63fe1676f75e2cf9e3490a467987eae298`.

The source object declares `Menu` twice; JavaScript leaves one public `Menu`
property. The inventory therefore has 27 public builder paths. Classification
is about the responsibility, not the current source directory.

Kernel invariant: every builder exposed from
`target/foundation/ui-runtime/src/skeletons.js` emits a literal kind and that
kind is already registered by `src/bootstrap.js` before READY. A historical
entry excluded below is deliberately not exposed by the kernel; it is never a
silently broken builder.

| Skeleton path | Historical builder | Emitted kind(s) | Historical Widget / direct closure | Classification | Phase 2.6 decision / legacy-kind adaptation |
|---|---|---|---|---|---|
| `Avatar` | `toolkit/skeleton/avatar.js` | `note` | `toolkit/builder/avatar.js` → `widgets/text/index.js` | `KEEP_KERNEL` | Retained; the non-MFS renderer supports text/avatar descriptor styling. |
| `Box.G` | `skeleton/box-g.js` | `box` | `toolkit/{builder,core}.js` → `widgets/box/index.js` | `KEEP_KERNEL` | Retained as literal `"box"`, flow `g`. |
| `Box.X` | `skeleton/box-x.js` | `box` | same | `KEEP_KERNEL` | Retained, flow `x`. |
| `Box.Y` | `skeleton/box-y.js` | `box` | same | `KEEP_KERNEL` | Retained, flow `y`; used by the pinned developer Widget fixture. |
| `Box.Z` | `skeleton/box-z.js` | `box` | same | `KEEP_KERNEL` | Retained, flow `none`; source previously took this from a historical globals table. |
| `Button.Icon` | `skeleton/button/icon.js` | `image_svg` | `builder/button/icon.js` → `widgets/image/svg/index.js` | `KEEP_KERNEL` | Retained; `KIND.image.svg` becomes exact string `"image_svg"`. |
| `Button.Label` | `skeleton/button/label.js` | `image_svg` | `builder/button/label.js` → SVG Widget | `KEEP_KERNEL` | Retained; same string adaptation. |
| `Button.Svg` | `skeleton/button/svg.js` | `image_svg` | `builder/button/svg.js` → SVG Widget | `KEEP_KERNEL` | Retained; used by the normal `ui-dev-tools/widget` template pattern. |
| `Element` | `skeleton/element.js` | `wrapper` | `toolkit/builder.js` → `widgets/blank/index.js` | `KEEP_KERNEL` | Retained as `"wrapper"`; no historical pseudo-constant lookup. |
| `FileSelector` | `skeleton/file-selector.js` | `fileselector` | `widgets/file-selector/index.js` | `KEEP_KERNEL` | Retained as a generic file-input boundary; storage/MFS service behaviour is absent. |
| `Entry` | `skeleton/entry/input.js` | `entry` | `widgets/entry/input/index.js` | `KEEP_KERNEL` | Retained as generic input descriptor with `autocomplete: "off"`. |
| `EntryBox` | `skeleton/entry/reminder.js` | `entry_reminder` | `widgets/entry/reminder/index.js` and error skeletons | `INVESTIGATE` | Excluded: the current closure uses validation/error/global application behaviour. Historical `KIND.entry_reminder` is documented, not initialized. |
| `Image.Smart` | `skeleton/image/smart.js` | `image_smart` | `widgets/image/smart/index.js` | `INVESTIGATE` | Excluded pending evidence separating generic image presentation from MFS/media model. Historical `KIND.image.smart` maps to `"image_smart"`. |
| `Image.Svg` | `skeleton/image/svg.js` | `image_svg` | `widgets/image/svg/index.js` | `KEEP_KERNEL` | Retained with the minimum chart/icon descriptor boundary. |
| `List.Scroll` | `skeleton/list/scroll.js` | `list_smart` | `builder/list/smart.js` → `widgets/list/smart/index.js` | `KEEP_KERNEL` | Retained as a static list descriptor; historical vendor/scroll plugins are not loaded. |
| `List.Smart` | `skeleton/list/smart.js` | `list_smart` | same | `KEEP_KERNEL` | Retained; static Kind resolves to `LetcList`. |
| `List.Table` | `skeleton/list/table.js` | `list_table` | `builder/list/table.js` → `widgets/list/table/index.js` | `KEEP_KERNEL` | Retained as a minimal list Widget; row/table service behaviour is not claimed. |
| `Menu` | `skeleton/menu.js` | `menu_topic` | `widgets/menu/index.js` | `INVESTIGATE` | Excluded: current menu Widget relies on navigation/service/global state beyond generic static rendering. |
| `Messenger` | `skeleton/messenger.js` | `messenger` | no matching entry in `kind/seeds/static.js` | `LEGACY` | Excluded. It is already unresolved in the inspected static seed; no replacement is invented. Historical `KIND.messenger` becomes literal `"messenger"` only for documentation. |
| `Note` | `skeleton/note.js` | `note` | `widgets/text/index.js` | `KEEP_KERNEL` | Retained. `Skeletons.Note → "note" → LetcText` is browser-tested. |
| `Profile` | `skeleton/profile.js` | `profile` | `widgets/profile/index.js` | `DEFER_TEAM` | Excluded: current profile rendering expresses application identity/profile experience, not the minimum Host/Visitor context. |
| `Progress` | `skeleton/progress.js` | `progress` | `widgets/progress/media/index.js` | `DEFER_MFS` | Excluded: historical implementation is explicitly media-progress oriented and calls loader/client state. |
| `RichText` | `skeleton/rich-text.js` | `rich_text` | `widgets/text/editable/index.js` | `INVESTIGATE` | Excluded: large editable/text sanitation closure needs a specific independent application requirement. Historical `KIND.rich_text` is `"rich_text"`. |
| `Textarea` | `skeleton/entry/textarea.js` | `entry` | `widgets/entry/input/index.js` | `KEEP_KERNEL` | Retained as a generic `"entry"` descriptor with `type: "textarea"`; historical `KIND.entry` removed. |
| `UserProfile` | `skeleton/profile.js` | `profile` | `widgets/profile/index.js` | `DEFER_TEAM` | Alias of `Profile`; excluded for the same reason. |
| `Wrapper.X` | `skeleton/wrapper-x.js` | `box` | `toolkit/builder.js` → `widgets/box/index.js` | `KEEP_KERNEL` | Retained with source-faithful `dialog__wrapper`, name and `sys_pn` descriptor treatment. |
| `Wrapper.Y` | `skeleton/wrapper-y.js` | `box` | same | `KEEP_KERNEL` | Retained, flow `y`. |

## Retained static kind map

The 19 retained builders produce eight pre-registered strings:

| Kind string | Phase 2.6 concrete class | Historical evidence |
|---|---|---|
| `box` | `LetcBox` | `widgets/box/index.js` |
| `entry` | `LetcEntry` | `widgets/entry/input/index.js` |
| `fileselector` | `LetcFileSelector` | `widgets/file-selector/index.js` |
| `image_svg` | `LetcSvgImage` | `widgets/image/svg/index.js` |
| `list_smart` | `LetcList` | `widgets/list/smart/index.js` |
| `list_table` | `LetcList` | `widgets/list/table/index.js` |
| `note` | `LetcText` | `widgets/text/index.js` |
| `wrapper` | `LetcBlank` | `widgets/blank/index.js` |

The source uses Marionette, Backbone, lodash, global tables and substantially
larger application behaviours. Phase 2.6 extracts the minimum class-based,
non-MFS rendering closure into `target/foundation/ui-runtime/src/widgets.js`.
It does not claim full behavioural parity with those historical implementations.
The exact reductions and the browser evidence are documented in
[`16-phase2.6-letc-bootstrap.md`](16-phase2.6-letc-bootstrap.md).
