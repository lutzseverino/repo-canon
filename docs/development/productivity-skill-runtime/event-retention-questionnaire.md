# Event retention launch discovery questionnaire

**Purpose:** Gather the operational evidence needed to choose the launch Retention window and archive approach for service Events.

**From:** Product owner, **To:** Staff reliability engineer, **How your answers will be used:** They will be recorded in the launch retention decision record.

## Context

I need to make the launch Event-retention decision, but you own the event-storage platform and the operational evidence behind it: capacity measurements, archive and restore capability, and incident-response practice. Please provide the measured facts and your recommendation so the decision reflects our actual operational limits and investigation needs.

## How to answer

Please respond by **18 September 2026**. This should take about **20 minutes**. Partial answers and “I don’t know” are useful; please flag uncertainty rather than skipping a question.

## Event volume and investigation needs

### What is the measured typical daily Event volume?

> 

### What is the measured peak daily Event volume?

> 

### What one-year growth in daily Event volume do you expect?

> 

### What minimum queryable Event history do incident investigations need?

_Why this matters: this sets the lower bound for the Retention window needed to diagnose incidents without restoring archived Events._

> 

### What minimum queryable Event history do audits need?

> 

## Cost and archive capability

### What storage-cost constraints apply to queryable Events at launch?

> 

### What retrieval-cost constraints apply when accessing archived Events?

> 

### Which archive tiers are available for Events at launch?

> 

### What restore time can we achieve for archived Events?

_Why this matters: it determines whether archived Events can support time-sensitive investigation and audit work._

> 

### What recent restore evidence supports that restore-time estimate?

> 

## Retention constraints and recommendation

### What deletion constraints apply to Events?

> 

### What legal constraints apply to Event retention or archiving?

> 

### What launch Retention window do you recommend?

> 

### What risks come with your recommended launch Retention window?

> 

### What archive approach do you recommend for Events after the Retention window?

> 

## Anything else?

### What else should we know before making the launch Event-retention decision?

> 
