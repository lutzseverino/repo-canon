The frontier has one remaining interaction to settle: `Retry-After` can override the next attempt, while the standard schedule is anchored to acceptance.

❓ **Q19** - **`Retry-After` interaction**: Should a valid `Retry-After` replace only the next pending fixed-offset retry—skipping any earlier scheduled offset it passes—while later offsets remain anchored to acceptance and the six-attempt maximum remains unchanged?

➡️ Recommend **yes**. It honors the dependency without shifting the whole schedule beyond the Retry window or accidentally adding attempts.