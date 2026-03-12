import Phaser from "phaser";

type InstructionsSceneData = {
  source?: "main-menu" | "pause-menu";
};

export class InstructionsScene extends Phaser.Scene {
  private source: "main-menu" | "pause-menu" = "main-menu";

  constructor() {
    super("InstructionsScene");
  }

  create(data: InstructionsSceneData = {}): void {
    this.source = data.source === "pause-menu" ? "pause-menu" : "main-menu";

    const { width, height } = this.scale;
    const overlay = this.source === "pause-menu";

    this.add.rectangle(width / 2, height / 2, width, height, overlay ? 0x000000 : 0x0f172a, overlay ? 0.74 : 1);

    const panelWidth = Math.min(1060, width * 0.94);
    const panelHeight = Math.min(760, height * 0.92);
    const centerX = width / 2;
    const centerY = height / 2;

    const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x111827, 0.97);
    panel.setStrokeStyle(2, 0x475569, 0.95);

    this.add.text(centerX, centerY - panelHeight / 2 + 44, "Instrucciones", {
      fontSize: "36px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.add.text(
      centerX - panelWidth / 2 + 28,
      centerY - panelHeight / 2 + 94,
      this.getText(),
      {
        fontSize: "17px",
        color: "#d1d5db",
        align: "left",
        wordWrap: { width: panelWidth - 56 }
      }
    ).setOrigin(0, 0);

    const backLabel = this.source === "pause-menu"
      ? "Volver al menu de pausa"
      : "Volver al menu principal";

    const buttonY = centerY + panelHeight / 2 - 46;
    const buttonBg = this.add.rectangle(centerX, buttonY, Math.min(440, panelWidth * 0.62), 44, 0x1f2937, 1);
    buttonBg.setStrokeStyle(2, 0x64748b, 0.95);

    const buttonText = this.add.text(centerX, buttonY, backLabel, {
      fontSize: "18px",
      color: "#e2e8f0",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const close = (): void => {
      if (this.source === "pause-menu") {
        this.scene.stop();
        return;
      }

      this.scene.start("MainMenuScene");
    };

    buttonBg.setInteractive({ useHandCursor: true })
      .on("pointerover", () => buttonBg.setFillStyle(0x334155, 1))
      .on("pointerout", () => buttonBg.setFillStyle(0x1f2937, 1))
      .on("pointerdown", close);
    buttonText.setInteractive({ useHandCursor: true }).on("pointerdown", close);

    this.input.keyboard?.on("keydown-ESC", close);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-ESC", close);
    });
  }

  private getText(): string {
    return [
      "1. Objetivo y condiciones de victoria",
      "- Ganas si destruyes todas las unidades enemigas.",
      "- Tambien ganas si destruyes el portadrones enemigo y las unidades restantes del rival se quedan sin combustible o sin municion.",
      "- Si un jugador destruye el portadrones enemigo, el mismo tiene ahora 2min para intentar destruir el portadrones del jugador y empatar, si no lo logra, gana el jugador.",
      "",
      "2. Seleccionar y deseleccionar",
      "- Click izquierdo en una unidad propia para seleccionarla.",
      "- Tambien puedes seleccionar unidades desde el panel lateral izquierdo.",
      "- Click derecho en el mapa para deseleccionar.",
      "- Rueda del mouse sobre el panel izquierdo para ciclar entre tus unidades.",
      "",
      "3. Movimiento",
      "- Sin unidad seleccionada: WASD mueve la camara libre.",
      "- Con unidad seleccionada: Click izquierdo del mouse mueven el dron.",
      "- Q y E y rueda del mouse cambian la altura (Z).",
      "- Click izquierdo en el mapa envia la unidad seleccionada a ese punto.",
      "",
      "4. Disparo",
      "- Tecla ESPACIO dispara con la unidad seleccionada.",
      "- Jugador 1: solo el dron aereo (AERIAL_DRONE) puede lanzar bombas.",
      "- Jugador 2: los drones lanzan misiles.",
      "- Para atacar, primero debes tener una unidad valida seleccionada.",
      "",
      "5. Recarga de municion y combustible",
      "- Selecciona un dron propio y acercalo a un portadrones aliado.",
      "- Cuando este dentro del rango de recarga, la recarga restaura municion y combustible.",
      "- Si estas fuera de rango del portadrones, no se puede recargar.",
      "",
      "6. Pausa",
      "- Tecla ESC abre o cierra el menu de pausa durante la partida."
    ].join("\n");
  }
}
