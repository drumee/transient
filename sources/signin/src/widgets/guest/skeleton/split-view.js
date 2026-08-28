const restrictedCard = require('./restricted-card');

// The redacted grid: eight tiles, the first row carrying a glyph. `art` picks the
// background glyph class, `label` is the width of the fake filename bar (Figma
// 1602:76979..77010). Purely decorative — see the aria-hidden note below.
const TILES = [
  { art: 'folder', label: 'w1' },
  { art: 'file', label: 'w2' },
  { art: 'image', label: 'w3' },
  { art: 'folder', label: 'w2' },
  { art: '', label: 'w1' },
  { art: '', label: 'w2' },
  { art: '', label: 'w3' },
  { art: '', label: 'w2' },
];

/**
 * Left panel: a fake window (traffic-light dots + view toggles) over a blurred file
 * grid, with the "Content Restricted" card centred on top.
 * @param {LetcBox} ui
 */
function filesPanel(ui) {
  const fig = ui.fig.family;

  const windowBar = Skeletons.Box.X({
    className: `${fig}__files-bar`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__dots`,
        kids: [1, 2, 3].map(() =>
          Skeletons.Element({ className: `${fig}__dot`, content: " " })
        ),
      }),
      Skeletons.Box.X({
        className: `${fig}__views`,
        kids: [
          Skeletons.Element({ className: `${fig}__view-grid`, content: " " }),
          Skeletons.Element({ className: `${fig}__view-list`, content: " " }),
        ],
      }),
    ],
  });

  // Decoration only: it must never be announced to a screen reader (it represents
  // content the visitor is NOT allowed to see) and must never take a click.
  // `pointer-events: none` is set in the skin.
  const grid = Skeletons.Box.X({
    className: `${fig}__grid`,
    attrOpt: { 'aria-hidden': 'true' },
    kids: TILES.map((t) =>
      Skeletons.Box.Y({
        className: `${fig}__tile`,
        kids: [
          Skeletons.Box.X({
            className: `${fig}__tile-art`,
            kids: t.art
              ? [Skeletons.Element({ className: `${fig}__tile-ico ${t.art}`, content: " " })]
              : [],
          }),
          Skeletons.Element({
            className: `${fig}__tile-label ${t.label}`,
            content: " ",
          }),
        ],
      })
    ),
  });

  return Skeletons.Box.Y({
    className: `${fig}__files`,
    kids: [windowBar, grid, restrictedCard(ui)],
  });
}

/**
 * Right panel: a blurred team-chat transcript above a non-functional input row.
 *
 * The sample messages are decoration, blurred past legibility, so they are NOT
 * localized. The input is a plain box — never a Skeletons.Entry — so an anonymous
 * visitor cannot type into a field that would go nowhere.
 * @param {LetcBox} ui
 */
function chatPanel(ui) {
  const fig = ui.fig.family;

  const outgoing = Skeletons.Box.Y({
    className: `${fig}__msg out`,
    kids: [
      Skeletons.Note({
        className: `${fig}__bubble out`,
        content: `Did everyone see <span class="${fig}__bubble-file">/spec_v2.docx</span>? I've updated the core requirements.`,
      }),
      Skeletons.Note({ className: `${fig}__msg-time`, content: "11:42 AM" }),
    ],
  });

  const incoming = Skeletons.Box.Y({
    className: `${fig}__msg in`,
    kids: [
      Skeletons.Note({ className: `${fig}__msg-author`, content: "Sarah K." }),
      Skeletons.Note({
        className: `${fig}__bubble in`,
        content: `Please check the <span class="${fig}__bubble-file">/Project_Brief_v2.pdf</span> for the latest revisions.`,
      }),
      Skeletons.Note({ className: `${fig}__msg-time`, content: "11:53 AM" }),
    ],
  });

  const system = Skeletons.Note({
    className: `${fig}__msg-system`,
    content: "Alex updated the folder name",
  });

  const messages = Skeletons.Box.Y({
    className: `${fig}__chat-msgs`,
    attrOpt: { 'aria-hidden': 'true' },
    kids: [outgoing, incoming, system],
  });

  const input = Skeletons.Box.X({
    className: `${fig}__chat-input`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__chat-field`,
        kids: [
          Skeletons.Box.X({
            className: `${fig}__chat-field-left`,
            kids: [
              Skeletons.Element({ className: `${fig}__chat-clip`, content: " " }),
              Skeletons.Note({
                className: `${fig}__chat-placeholder`,
                content: LOCALE.TYPE_A_MESSAGE || "Type a message...",
              }),
            ],
          }),
          Skeletons.Element({ className: `${fig}__chat-send`, content: " " }),
        ],
      }),
    ],
  });

  return Skeletons.Box.Y({
    className: `${fig}__chat`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__chat-head`,
        kids: [
          Skeletons.Note({
            className: `${fig}__chat-title`,
            content: LOCALE.TEAM_CHAT || "Team chat",
          }),
        ],
      }),
      Skeletons.Box.Y({
        className: `${fig}__chat-body`,
        kids: [messages],
      }),
      input,
    ],
  });
}

/**
 * The 75/25 split: redacted file grid on the left, private chat panel on the right.
 * @param {LetcBox} ui
 */
function __skl_signin_guest_split_view(ui) {
  const fig = ui.fig.family;

  return Skeletons.Box.X({
    className: `${fig}__split`,
    debug: __filename,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__split-inner`,
        kids: [filesPanel(ui), chatPanel(ui)],
      }),
    ],
  });
}

module.exports = __skl_signin_guest_split_view;
