# Control-and-emergency

Ride control tools for a 20-pod fleet.

## Override Console

Operator desktop panel in [`override-console/`](./override-console/):

- 20-pod status grid with Mode / iPad state
- Stage timers (load/unload 45s, up/down 1:40, peak 9s, ride 4:15)
- Spacing 20 m @ 2 m/s → 10 s headway
- Load iPad Selections + Operator Override (Pod / Mode / Apply)
- Modes: Idle, iPad, Load, Unload, Up, Peak, Down, Hold, E-Stop

```bash
cd override-console
npm install
npm run dev
```
