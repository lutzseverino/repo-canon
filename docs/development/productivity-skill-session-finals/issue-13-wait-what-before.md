Import batch is in **Quarantine**.

- Parser processed 100 rows: 84 accepted, 16 malformed.
- Any malformed rows caused the entire batch to require operator review.
- No customer data was deleted.
- Recovery path: correct the 16 rows and submit a new import file; the status does not indicate an in-place retry/resume.