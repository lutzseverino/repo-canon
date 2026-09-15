The frontier is empty. Shared understanding:

- The wall display shows every active Incident card.
- Attention is determined by time since the card’s last update.
- Cards are ordered oldest update first; same-age cards share priority.
- An Incident card becomes “Needs attention” exactly at 15 minutes without an update.
- All cards show elapsed time and Owner; Owner does not affect ranking.
- Attention-worthy cards display a textual “Needs attention” marker with high-contrast warning color.
- The board re-evaluates time-based state every minute and immediately recalculates/repositions a card when it receives an update.
- Exact colors and animation are implementation details.
- No new fields or notifications are introduced.

Repository facts came from read-only delegate `/root/dispatch_facts`: existing Owner and last-updated fields, wall-display context, and no prior ranking policy.

Please confirm this shared understanding before any action.