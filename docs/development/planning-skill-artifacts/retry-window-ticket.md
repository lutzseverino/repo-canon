# 02: Choose the default Retry window

Type: grilling
Status: resolved
Blocked by: 01

## Question

Should the default Retry window be 15 minutes or 60 minutes? The operations evidence says carrier incidents normally clear within 20 minutes; operators prefer one hour to avoid manual replay.

## Answer

Use a 60-minute default Retry window. A 15-minute window would end before
carrier incidents normally clear, whereas 60 minutes also avoids manual replay
for operators.
