# Lumen Relay

Lumen Relay is a small arcade-style HTML5 Canvas game made for a Computer Graphics final project. The player moves a relay dish, catches falling light prisms, avoids red static pulses, and tries to keep the signal alive as the game gets faster.

The project is written with plain HTML, CSS, and JavaScript. It does not use prepared assets, image packs, npm packages, frameworks, or external game libraries.

## Game Idea

The screen shows a changing target frequency. Falling prisms have different colors, and the player gets the best score by catching prisms that match the current target. White charge prisms help fill the relay meter. When the meter is full, a beam sweep clears dangerous objects from the screen.

Red static pulses are harmful. Catching one costs a life, and missing a required matching prism also costs a life. The game ends after three lost lives.

## Controls

| Action | Key |
| --- | --- |
| Move left | A or Left Arrow |
| Move right | D or Right Arrow |
| Start / restart | Space or Enter |
| Pause | P or Escape |
| Mute sound | M |

On mobile screens, holding the left or right side of the game area moves the player.

## Features

- Continuous start, play, pause, game-over, and restart loop
- Score, lives, high score, combo, level, and relay meter
- Increasing speed and spawn rate over time
- Rotating and scaling falling objects
- Procedural stars, nebula bands, prisms, static pulses, particles, and player dish
- Collision detection between the player and falling objects
- Screen shake, flash, glow, particles, and floating score text
- Responsive 3:2 canvas layout

## Computer Graphics Techniques

The game demonstrates several basic computer graphics concepts:

- Canvas 2D rendering
- Translation for movement
- Rotation for spinning objects
- Scaling for depth feedback
- Transformation stack with `save`, `translate`, `rotate`, `scale`, and `restore`
- Animation loop with `requestAnimationFrame`
- Particle effects with fading alpha
- Parallax background motion
- AABB collision detection
- Dynamic gradients and shadow effects

## Files

```text
LumenRelay
|-- index.html
|-- style.css
|-- game.js
|-- README.md
|-- .gitattributes
```

## Live Link

After GitHub Pages is enabled, the game will be available at:

```text
https://EmirhanSelcen.github.io/LumenRelay/
```

## Author

Emirhan Selcen
