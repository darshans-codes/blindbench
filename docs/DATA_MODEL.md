# Data model

The SQLite `studies` migration stores ID, fictional title, batch minimum, window in hours, seed marker, row revision, and UTC update time. The database applies numeric constraints. The demo seed is installed once in the same transaction as schema creation. Concurrent edits match the stored revision and stale writes return 409.

Schema revision 2 adds `fixture_jobs`, with one job per study revision and a snapshot of that revision's batch minimum and window. The local worker atomically claims a job and records the result only while its attempt still owns the lease. An expired lease or a failed run can be retried once with a fresh synthetic Docker project. The receipt stores job state and attempt metadata. Participant data, reports, keys and exact results stay outside the control store.

Draft creation uses the fixed compensation template, with bins expressed in annual INR lakh. The future committed form must freeze bin edges, epsilon/delta, expected group root, task identifier and protocol version. The current store has no participant, submission or result tables. The target schema is specified in §12.

Schema revision 3 adds `study_policy_snapshots`. Each row stores one public policy preview and its digest for a specific study revision. Retries preserve the original bytes. Database updates to saved snapshots are rejected. Editing a draft creates a new revision and leaves prior exports available.
