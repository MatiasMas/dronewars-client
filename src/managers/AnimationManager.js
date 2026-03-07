export class AnimationManager {
    static KEYS = {
        droneChinoMLateral: "droneChinoMLateral",
        droneChinoDLateral: "droneChinoDLateral",
        droneChinoBmLateral: "droneChinoBmLateral",
        droneChinoMCenital: "droneChinoMCenital",
        droneChinoDCenital: "droneChinoDCenital",
        dronePortuguesMLateral: "dronePortuguesMLateral",
        dronePortuguesDLateral: "dronePortuguesDLateral",
        dronePortuguesMsLateral: "dronePortuguesMsLateral",
        dronePortuguesMCenital: "dronePortuguesMCenital",
        dronePortuguesDCenital: "dronePortuguesDCenital",
        carrierChinoMLateral: "carrierChinoMLateral",
        carrierChinoDLateral: "carrierChinoDLateral",
        carrierChinoMCenital: "carrierChinoMCenital",
        carrierChinoDCenital: "carrierChinoDCenital",
        carrierPortuguesMLateral: "carrierPortuguesMLateral",
        carrierPortuguesDLateral: "carrierPortuguesDLateral",
        carrierPortuguesMCenital: "carrierPortuguesMCenital",
        carrierPortuguesDCenital: "carrierPortuguesDCenital",
    };
    /**
     * Carga todos los spritesheets necesarios para las animaciones.
     * Se llama desde el preload de la GameScene.
     */
    static preload(scene) {
        scene.load.spritesheet("droneChinoMovLateral", "assets/drone/chinese/Dron_Chino_Movimiento_Lateral.png", {
            frameWidth: 48,
            frameHeight: 18,
        });
        scene.load.spritesheet("droneChinoDesLateral", "assets/drone/chinese/Dron_Chino_Destruccion_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("droneChinoBombLateral", "assets/drone/chinese/Dron_Chino_Bomba_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("droneChinoMovCenital", "assets/drone/chinese/Dron_Chino_Movimiento_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("droneChinoDesCenital", "assets/drone/chinese/Dron_Chino_Destruccion_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("dronePortuguesMovLateral", "assets/drone/portuguese/Dron_Portugues_Movimiento_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("dronePortuguesDesLateral", "assets/drone/portuguese/Dron_Portugues_Destruccion_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("dronePortuguesMisilLateral", "assets/drone/portuguese/Dron_Portugues_Misil_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("dronePortuguesMovCenital", "assets/drone/portuguese/Dron_Portugues_Movimiento_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("dronePortuguesDesCenital", "assets/drone/portuguese/Dron_Portugues_Destruccion_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierChinoMovLateral", "assets/carriers/chinese/Portadrones_Chino_Movimiento_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierChinoDesLateral", "assets/carriers/chinese/Portadrones_Chino_Destruccion_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierChinoMovCenital", "assets/carriers/chinese/Portadrones_Chino_Movimiento_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierChinoDesCenital", "assets/carriers/chinese/Portadrones_Chino_Destruccion_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierPortuguesMovLateral", "assets/carriers/portuguese/Portadrones_Portugues_Movimiento_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierPortuguesDesLateral", "assets/carriers/portuguese/Portadrones_Portugues_Destruccion_Lateral.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierPortuguesMovCenital", "assets/carriers/portuguese/Portadrones_Portugues_Movimiento_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        scene.load.spritesheet("carrierPortuguesDesCenital", "assets/carriers/portuguese/Portadrones_Portugues_Destruccion_Cenital.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
    }
    /**
     * Registra todas las animaciones en el AnimationManager.
     * Se llama desde el create de la GameScene.
     */
    static createAnimations(scene) {
        const anims = scene.anims;
        anims.create({
            key: this.KEYS.droneChinoMLateral,
            frames: anims.generateFrameNumbers("droneChinoMovLateral", {
                start: 0,
                end: 3,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.droneChinoDLateral,
            frames: anims.generateFrameNumbers("droneChinoDesLateral", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.droneChinoBmLateral,
            frames: anims.generateFrameNumbers("droneChinoBombLateral", {
                start: 0,
                end: 5,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.droneChinoMCenital,
            frames: anims.generateFrameNumbers("droneChinoMovCenital", {
                start: 0,
                end: 3,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.droneChinoDCenital,
            frames: anims.generateFrameNumbers("droneChinoDesCenital", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.dronePortuguesMLateral,
            frames: anims.generateFrameNumbers("dronePortuguesMovLateral", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.dronePortuguesDLateral,
            frames: anims.generateFrameNumbers("dronePortuguesDesLateral", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.dronePortuguesMsLateral,
            frames: anims.generateFrameNumbers("dronePortuguesMisilLateral", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.dronePortuguesMCenital,
            frames: anims.generateFrameNumbers("dronePortuguesMovCenital", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.dronePortuguesDCenital,
            frames: anims.generateFrameNumbers("dronePortuguesDesCenital", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.carrierChinoMLateral,
            frames: anims.generateFrameNumbers("carrierChinoMovLateral", {
                start: 0,
                end: 3,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.carrierChinoDLateral,
            frames: anims.generateFrameNumbers("carrierChinoDesLateral", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.carrierChinoMCenital,
            frames: anims.generateFrameNumbers("carrierChinoMovCenital", {
                start: 0,
                end: 3,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.carrierChinoDCenital,
            frames: anims.generateFrameNumbers("carrierChinoDesCenital", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.carrierPortuguesMLateral,
            frames: anims.generateFrameNumbers("carrierPortuguesMovLateral", {
                start: 0,
                end: 6,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.carrierPortuguesDLateral,
            frames: anims.generateFrameNumbers("carrierPortuguesDesLateral", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
        anims.create({
            key: this.KEYS.carrierPortuguesMCenital,
            frames: anims.generateFrameNumbers("carrierPortuguesMovCenital", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: -1,
        });
        anims.create({
            key: this.KEYS.carrierPortuguesDCenital,
            frames: anims.generateFrameNumbers("carrierPortuguesDesCenital", {
                start: 0,
                end: 7,
            }),
            frameRate: 6,
            repeat: 0,
        });
    }
}
