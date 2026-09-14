The import file was processed, but it did not complete successfully: **16 of its 100 rows were malformed**. While **84 rows were accepted by the parser**, the malformed rows caused the whole import batch to be placed in **Quarantine** for operator review.

No existing customer data was deleted or rolled back as part of this outcome.

What you need to do next:

1. Locate and correct the 16 malformed rows in the source file.
2. Create a corrected replacement file containing those fixes.
3. Submit that file as a **new import batch**.

This batch is not awaiting an automatic retry; Quarantine means operator intervention and a new submission are required.