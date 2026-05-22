# Eval run: run-fix2-dampening

```
label:                         run-fix2-dampening
seekers:                       20 (19 non-finance)
NON-FINANCE avg field relevance: 65%
NON-FINANCE avg finance leakage: 17%
NON-FINANCE worst finance leak:  60%
NON-FINANCE avg distinct inds:   2.89
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
Law                 pick  100%    0%   1  2.6    0%  Law:10
Education           pick  100%    0%   1  2.7    0%  Education:10
Art / Design        pick  100%    0%   1  2.0    0%  Media:10
Nonprofit           pick   20%   60%   4  2.9    0%  Finance:6 Nonprofit:2 Software:1 Technology:1
Skilled Trades      skip    0%   30%   5  2.0    0%  Finance:3 Technology:3 Sports:2 Law:1 Real Estate:1
Military            pick   50%   20%   4  2.4    0%  Government:5 Finance:2 Technology:2 Consulting:1
Sports              pick  100%    0%   1  3.0    0%  Sports:10
Entertainment       pick   90%   10%   2  2.3    0%  Media:9 Finance:1
Journalism          pick   90%    0%   2  2.1    0%  Media:9 Education:1
Engineering         pick  100%    0%   1  2.8    0%  Technology:10
Academia            pick  100%    0%   1  2.6    0%  Education:10
Hospitality         skip   n/a   30%   5  2.9    0%  Finance:3 Technology:3 Real Estate:2 Sports:1 (none):1
Agriculture         skip   n/a   60%   3  2.1    0%  Finance:6 Technology:2 Sports:2
Social Work         pick   20%    0%   7  2.0    0%  Consulting:3 Nonprofit:2 Technology:1 Education:1 Manufacturing:1 Sports:1 Healthcare:1
Ministry            pick   20%   50%   4  2.0    0%  Finance:5 Nonprofit:2 Sports:2 Real Estate:1
Real Estate         pick   70%    0%   3  2.2    0%  Real Estate:7 Technology:2 Software:1
Manufacturing       skip    0%   50%   4  2.8    0%  Finance:5 Technology:3 Education:1 Healthcare:1
Government          pick   50%   20%   5  2.4    0%  Government:5 Finance:2 Healthcare:1 Education:1 Consulting:1
Finance (control)   pick  100%  100%   1  3.0    0%  Finance:10
```