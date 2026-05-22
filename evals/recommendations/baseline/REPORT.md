# Eval run: baseline

```
label:                         baseline
seekers:                       20 (19 non-finance)
NON-FINANCE avg field relevance: 53%
NON-FINANCE avg finance leakage: 28%
NON-FINANCE worst finance leak:  70%
NON-FINANCE avg distinct inds:   3.42
NON-FINANCE avg generic-only:    0%
FINANCE control field relevance: 100%
FINANCE control finance share:   100%
```

## Per-seeker

`fld`=field relevance, `fin`=finance leakage, `di`=distinct industries, `rsn`=avg reasons/card, `gen`=cards with only generic reasons.

```
field               pref   fld   fin  di  rsn   gen  industry mix (top10)
-------------------------------------------------------------------------
Medicine            pick  100%    0%   1  2.8    0%  Healthcare:10
Law                 pick   80%   10%   3  2.9    0%  Law:8 Finance:1 Education:1
Education           pick  100%    0%   1  2.7    0%  Education:10
Art / Design        pick   70%   10%   3  1.8    0%  Media:7 Sports:2 Finance:1
Nonprofit           pick   10%   60%   5  3.0    0%  Finance:6 Software:1 Nonprofit:1 Technology:1 Education:1
Skilled Trades      skip    0%   60%   4  2.2    0%  Finance:6 Sports:2 Law:1 Real Estate:1
Military            pick   20%   50%   4  2.8    0%  Finance:5 Government:2 Technology:2 Consulting:1
Sports              pick  100%    0%   1  3.0    0%  Sports:10
Entertainment       pick   40%   30%   5  2.9    0%  Media:4 Finance:3 Sports:1 Real Estate:1 Technology:1
Journalism          pick   50%   30%   4  2.4    0%  Media:5 Finance:3 Education:1 Healthcare:1
Engineering         pick  100%    0%   1  2.8    0%  Technology:10
Academia            pick  100%    0%   1  2.6    0%  Education:10
Hospitality         skip   n/a   70%   4  2.3    0%  Finance:7 Sports:1 Real Estate:1 Technology:1
Agriculture         skip   n/a   70%   3  2.0    0%  Finance:7 Sports:2 Technology:1
Social Work         pick   20%    0%   7  2.0    0%  Consulting:3 Nonprofit:2 Technology:1 Education:1 Sports:1 Manufacturing:1 Healthcare:1
Ministry            pick   20%   50%   4  2.0    0%  Finance:5 Nonprofit:2 Sports:2 Real Estate:1
Real Estate         pick   70%   10%   4  2.2    0%  Real Estate:7 Software:1 Finance:1 Technology:1
Manufacturing       skip    0%   50%   4  2.7    0%  Finance:5 Sports:2 Technology:2 Education:1
Government          pick   20%   40%   6  2.6    0%  Finance:4 Government:2 Healthcare:1 Education:1 Consulting:1 Technology:1
Finance (control)   pick  100%  100%   1  3.0    0%  Finance:10
```