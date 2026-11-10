# Sculpted hero models

Put a `.glb` file here and list it in `heroes.json` to mount it in the arcade room in place of the built-in hero.

```json
{ "hoot": { "file": "hoot.glb", "compare": true, "rotY": 0 } }
```

- the key is the hero id: leonidas, atreus, hoot, trey, baller, frazzle, ilia, spud, sirplop
- `compare: true` shows the new model next to the old one, to judge the difference
- `rotY` (degrees) turns the model if it does not face forward; `scale` (default 1) and `y` adjust size and height
- an empty `{}` means: use the built-in heroes everywhere
