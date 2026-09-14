One product ambiguity remains: the selected delays otherwise conflict with the 24-hour Retry window if interpreted as intervals after each failed attempt.

❓ **Q18** - **Retry-schedule clock**: Should `5m, 30m, 2h, 8h, 20h` be fixed offsets from Export-request acceptance (not delays accumulated after each failure), with an immediate initial attempt?

➡️ Recommend **yes**. It guarantees all six total attempts fit inside the chosen 24-hour Retry window; any attempt that cannot start before the boundary is skipped and the Export request becomes terminally failed.