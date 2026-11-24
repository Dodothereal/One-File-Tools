# Succubus Wings

NeoForge mod for Minecraft 1.21.1 (All the Mods 10) that gives players large, animated succubus wings with a tail, jewellery, glow and particles.

## Install

Put `succubuswings-neoforge-1.21.1-1.0.0.jar` in the `mods` folder of:

- every client that should wear or see wings, and
- the server, so wing settings are relayed between players.

Without the server jar the wings still work, but only you see your own.

## Use

- `J` or `/wings` opens the wardrobe: live 3D preview, 15 colour schemes, custom skin/bone/glow colours, size, glow, and toggles for jewellery, tail, embers and sound.
- `/wings on|off|toggle`, `/wings scheme <id>`, `/wings size <value>`, `/wings glow <value>`.

The wings react to idle, walking, sprinting, sneaking, jumping, falling, creative flight, elytra gliding, swimming, sleeping, riding, attacking and taking damage.

## Build

Needs JDK 21.

    ./gradlew build              # jar in build/libs
    ./gradlew generateTextures   # regenerate the procedural textures
    ./gradlew renderPreview      # headless renders in build/preview
