# SKZOO Escape — v4

An unofficial browser-based, fan-made top-down cave maze game, featuring the user's supplied SKZOO heads and seven user-supplied JYP photo sprites.

## Play offline

Open `SKZOO_Escape.html` in Chrome or Edge. It contains **all** code, art, and sound synthesis in a single offline-friendly file. You do not need to install software or be online. If your chat app cannot preview HTML, **download the ZIP and extract it** first.

## Publish on GitHub Pages

Extract the GitHub ZIP. Upload `index.html`, `game.js`, `style.css`, and the entire `assets/` directory into the top level of your GitHub repository, replacing the older version. Commit the files, and hard-refresh your site after publishing (Ctrl + Shift + R). The start page for GitHub Pages is `index.html`.

## Controls

- WASD / arrow keys — move
- Hold Shift — sprint, consuming stamina
- Hold E next to a cage — unlock with an uninterrupted three-second hold; progress bar does not display time
- 1 / 2 / 3, or click an on-screen slot — use inventory items
- M — map; P / Escape — pause
- Touchscreen — D-pad, RUN, and hold FREE to unlock

## v4 changes

1. Original synthesized cave ambience now includes varied, echoing water drips, cavern wind, low-frequency drones, and a soft, sparse creepy melody. The existing urgent synthesized soundtrack begins during the final escape.
2. Hunters accelerate when alerted, but maximum straight-line speeds are now 174 (Explorer), 184 (Brave), 197 (Nightmare) units/s. Wolf Chan sprints at 223.2 (Explorer) or 208.8 (Brave/Nightmare) units/s without temporary buffs/debuffs. You can outrun a hunter in open corridors, but maze turns and depleted stamina still matter.
3. A new hunter appears after rescues 1–6, so there are seven hunters when all friends are saved. Each dispatch triggers a bold on-screen banner: **A JYP has been dispatched!**
4. The unlock progress bar is unchanged in duration, but no longer shows the numerical timer.
5. Every rescued friend makes independent ~1.8%-per-second rolls *while a hunter is chasing Wolf Chan*, with a shared nine-second cooldown between successful stuns. On success, the friend throws ice cream at the nearest chasing JYP, showing **[Friend name] threw ice cream at JYP!** and freezing that monster for **two seconds**. More rescued friends mean more opportunities to trigger a stun.
6. Clicking in-game hotbar items works alongside keyboard shortcuts.

## Cave audio note

Web browsers require an interaction before audio can play. Click **Enter the Maze**, then unmute the in-game note icon if needed. All ambience, monster roars, ice cream hit sounds, and chase music are generated locally in the browser without external audio files or copyrighted tracks.

## Credits

This is an unofficial fan-game prototype using user-supplied reference art. The game is not endorsed by the owners of the characters or photographs. If publishing publicly, check the rights and permissions for the supplied images.
