/**
 * Gerenciador de cena que configura e mantém o ambiente 3D
 * Responsável por câmera, iluminação, objetos de cena e renderização
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { GAME } from './config.js';

export class SceneManager {
    constructor(renderer) {
        // Armazena a referência ao renderizador
        this.renderer = renderer;
        
        // Cria a cena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Céu azul claro
        
        // Cria a câmera
        this.camera = new THREE.PerspectiveCamera(
            GAME.FOV,
            window.innerWidth / window.innerHeight,
            GAME.NEAR_PLANE,
            GAME.FAR_PLANE
        );
        this.camera.position.set(0, 1.8, 0); // Altura de um humano médio
        this.camera.lookAt(0, 1.8, -1);
        
        // Flag para debug
        this.debugMode = GAME.DEBUG_MODE;
        
        // Configuração de iluminação
        this.setupLighting();
        
        // Cria o chão e objetos da cena
        this.createEnvironment();
        
        console.log("SceneManager: Cena inicializada com sucesso!");
    }
    
    /**
     * Configura as luzes na cena
     */
    setupLighting() {
        // Luz ambiente
        this.ambientLight = new THREE.AmbientLight(0xffffff, GAME.AMBIENT_LIGHT);
        this.scene.add(this.ambientLight);
        
        // Luz direcional (simulando o sol)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(100, 100, 100);
        this.directionalLight.castShadow = true;
        
        // Configuração de sombras para a luz direcional
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        
        const shadowSize = 50;
        this.directionalLight.shadow.camera.left = -shadowSize;
        this.directionalLight.shadow.camera.right = shadowSize;
        this.directionalLight.shadow.camera.top = shadowSize;
        this.directionalLight.shadow.camera.bottom = -shadowSize;
        this.directionalLight.shadow.camera.near = 1;
        this.directionalLight.shadow.camera.far = 500;
        this.directionalLight.shadow.bias = -0.001;
        
        this.scene.add(this.directionalLight);
        
        // Luz de ponto (pode ser usada para luzes de ambiente)
        this.pointLights = [];
        
        // Exemplo: adiciona algumas luzes de ponto em posições estratégicas
        const pointLightPositions = [
            { x: 10, y: 5, z: 0, color: 0xff0000, intensity: 1 },
            { x: -10, y: 5, z: 0, color: 0x0000ff, intensity: 1 },
            { x: 0, y: 5, z: 10, color: 0x00ff00, intensity: 1 }
        ];
        
        // Cria as luzes de ponto
        pointLightPositions.forEach(pos => {
            const pointLight = new THREE.PointLight(pos.color, pos.intensity, 20);
            pointLight.position.set(pos.x, pos.y, pos.z);
            pointLight.castShadow = true;
            this.scene.add(pointLight);
            this.pointLights.push(pointLight);
        });
        
        console.log("SceneManager: Iluminação configurada");
    }
    
    /**
     * Cria o ambiente 3D: chão, céu, etc.
     */
    createEnvironment() {
        // Geometria do chão
        const floorGeometry = new THREE.PlaneGeometry(100, 100);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x666666, 
            roughness: 0.8, 
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // Adiciona decorações para o ambiente (base da Corporação Nebulosa)
        this.createBaseStructures();
        
        // Adiciona obstáculos
        this.createObstacles();
        
        // Adiciona céu
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
    }
    
    /**
     * Cria as estruturas da base da Corporação Nebulosa
     */
    createBaseStructures() {
        // Materiais
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x444444, 
            roughness: 0.7, 
            metalness: 0.3 
        });
        
        const metalMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.2,
            metalness: 0.8
        });
        
        const emissiveMaterial = new THREE.MeshStandardMaterial({
            color: 0x0055ff,
            emissive: 0x0055ff,
            emissiveIntensity: 0.5,
            roughness: 0.5,
            metalness: 0.8
        });
        
        // Paredes externas da base (formando um U)
        const createWall = (width, height, depth, x, y, z) => {
            const wallGeometry = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(x, y, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            return wall;
        };
        
        // Parede frontal
        createWall(50, 5, 1, 0, 2.5, -25);
        
        // Parede lateral esquerda
        createWall(1, 5, 50, -25, 2.5, 0);
        
        // Parede lateral direita
        createWall(1, 5, 50, 25, 2.5, 0);
        
        // Terminal - objetivo da missão 2
        const terminalPosition = this.createTerminal(
            new THREE.Vector3(20, 0, 20)
        );
        
        // Plataforma de extração - objetivo da missão 5
        this.createExtractionPoint(
            new THREE.Vector3(0, 0, -30)
        );
        
        // Adiciona várias torres de comunicação pela base
        this.createCommunicationTower(new THREE.Vector3(-15, 0, -15));
        this.createCommunicationTower(new THREE.Vector3(15, 0, -15));
        this.createCommunicationTower(new THREE.Vector3(-15, 0, 15));
        
        // Containers e caixas
        for (let i = 0; i < 10; i++) {
            const size = 1 + Math.random() * 2;
            const x = (Math.random() - 0.5) * 40;
            const z = (Math.random() - 0.5) * 40;
            
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue; // Evita colocar no centro
            
            const containerGeometry = new THREE.BoxGeometry(size, size, size);
            const container = new THREE.Mesh(
                containerGeometry, 
                new THREE.MeshStandardMaterial({ 
                    color: Math.random() > 0.5 ? 0x555555 : 0x333399, 
                    roughness: 0.9 
                })
            );
            
            container.position.set(x, size/2, z);
            container.castShadow = true;
            container.receiveShadow = true;
            this.scene.add(container);
        }
    }
    
    /**
     * Cria um terminal (objetivo da missão 2)
     * @param {THREE.Vector3} position - Posição do terminal
     * @returns {THREE.Vector3} - Posição exata do terminal criado
     */
    createTerminal(position) {
        // Grupo para o terminal
        const terminalGroup = new THREE.Group();
        terminalGroup.position.copy(position);
        
        // Base
        const baseGeometry = new THREE.BoxGeometry(4, 0.5, 4);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.7,
            metalness: 0.5
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.25;
        base.receiveShadow = true;
        terminalGroup.add(base);
        
        // Suporte
        const supportGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 16);
        const supportMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777,
            roughness: 0.2,
            metalness: 0.8
        });
        const support = new THREE.Mesh(supportGeometry, supportMaterial);
        support.position.y = 1.25;
        support.castShadow = true;
        terminalGroup.add(support);
        
        // Tela
        const screenGeometry = new THREE.BoxGeometry(2, 1.2, 0.1);
        const screenMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            emissive: 0x0088ff,
            emissiveIntensity: 0.5,
            roughness: 0.5
        });
        const screen = new THREE.Mesh(screenGeometry, screenMaterial);
        screen.position.set(0, 2, 0);
        screen.rotation.x = Math.PI / 6; // Inclina a tela
        screen.castShadow = true;
        terminalGroup.add(screen);
        
        // Luz no terminal
        const light = new THREE.PointLight(0x0088ff, 1, 10);
        light.position.set(0, 2, 0);
        terminalGroup.add(light);
        
        // Adiciona o terminal à cena
        this.scene.add(terminalGroup);
        
        // Anima a luz do terminal
        const animate = () => {
            const intensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
            light.intensity = intensity;
            screenMaterial.emissiveIntensity = intensity * 0.5;
            
            requestAnimationFrame(animate);
        };
        animate();
        
        return position;
    }
    
    /**
     * Cria o ponto de extração para a missão final
     * @param {THREE.Vector3} position - Posição do ponto de extração
     */
    createExtractionPoint(position) {
        // Plataforma de extração
        const platformGeometry = new THREE.CylinderGeometry(5, 5, 0.5, 32);
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.7,
            metalness: 0.3
        });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.copy(position);
        platform.position.y = 0.25;
        platform.receiveShadow = true;
        this.scene.add(platform);
        
        // Marcações na plataforma
        const markingsGeometry = new THREE.RingGeometry(4, 4.5, 32);
        const markingsMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide
        });
        const markings = new THREE.Mesh(markingsGeometry, markingsMaterial);
        markings.position.copy(position);
        markings.position.y = 0.51;
        markings.rotation.x = -Math.PI / 2;
        this.scene.add(markings);
        
        // Luzes ao redor da plataforma
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = position.x + Math.cos(angle) * 4.5;
            const z = position.z + Math.sin(angle) * 4.5;
            
            const lightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
            const lightMaterial = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                emissive: 0x00ff00,
                emissiveIntensity: 1
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(x, 0.7, z);
            this.scene.add(light);
            
            // Luz pontual
            const pointLight = new THREE.PointLight(0x00ff00, 1, 5);
            pointLight.position.set(x, 0.7, z);
            this.scene.add(pointLight);
            
            // Anima as luzes
            const animate = () => {
                const time = Date.now() * 0.001;
                const phase = (i / 8) * Math.PI * 2;
                const intensity = 0.5 + 0.5 * Math.sin(time * 2 + phase);
                
                pointLight.intensity = intensity;
                lightMaterial.emissiveIntensity = intensity;
                
                requestAnimationFrame(animate);
            };
            animate();
        }
    }
    
    /**
     * Cria uma torre de comunicação
     * @param {THREE.Vector3} position - Posição da torre
     */
    createCommunicationTower(position) {
        // Grupo para a torre
        const towerGroup = new THREE.Group();
        towerGroup.position.copy(position);
        
        // Base da torre
        const baseGeometry = new THREE.BoxGeometry(3, 0.5, 3);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.7,
            metalness: 0.3
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.25;
        base.receiveShadow = true;
        towerGroup.add(base);
        
        // Suporte central da torre
        const supportGeometry = new THREE.CylinderGeometry(0.2, 0.3, 8, 8);
        const supportMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.3,
            metalness: 0.7
        });
        const support = new THREE.Mesh(supportGeometry, supportMaterial);
        support.position.y = 4.25;
        support.castShadow = true;
        towerGroup.add(support);
        
        // Antenas no topo
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
            const antenna = new THREE.Mesh(antennaGeometry, supportMaterial);
            antenna.position.set(
                Math.cos(angle) * 0.7,
                8.25,
                Math.sin(angle) * 0.7
            );
            antenna.rotation.x = Math.PI / 4;
            antenna.rotation.z = angle;
            antenna.castShadow = true;
            towerGroup.add(antenna);
        }
        
        // Luz de aviso no topo
        const lightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.y = 8.5;
        towerGroup.add(light);
        
        // Luz pontual
        const pointLight = new THREE.PointLight(0xff0000, 1, 5);
        pointLight.position.y = 8.5;
        towerGroup.add(pointLight);
        
        // Adiciona a torre à cena
        this.scene.add(towerGroup);
        
        // Anima a luz de aviso
        const animate = () => {
            const time = Date.now() * 0.001;
            const blink = time % 1 > 0.5 ? 1 : 0.2;
            
            pointLight.intensity = blink;
            lightMaterial.emissiveIntensity = blink;
            
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    /**
     * Cria obstáculos e elementos interativos na cena
     */
    createObstacles() {
        // Material para obstáculos
        const obstacleMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777,
            roughness: 0.7,
            metalness: 0.3
        });
        
        // Cria alguns obstáculos (caixas) em diferentes posições
        const obstaclePositions = [
            { x: 10, y: 1, z: -10, width: 2, height: 2, depth: 2 },
            { x: -15, y: 1, z: -8, width: 4, height: 2, depth: 2 },
            { x: 15, y: 1, z: 12, width: 3, height: 2, depth: 3 },
            { x: -8, y: 1, z: 15, width: 2, height: 2, depth: 2 },
            { x: 0, y: 2, z: 0, width: 3, height: 4, depth: 3 }
        ];
        
        // Cria os obstáculos
        this.obstacles = [];
        
        obstaclePositions.forEach(pos => {
            const obstacleGeometry = new THREE.BoxGeometry(pos.width, pos.height, pos.depth);
            const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
            obstacle.position.set(pos.x, pos.y, pos.z);
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;
            
            // Adiciona o obstáculo à cena e ao array para referência futura
            this.scene.add(obstacle);
            this.obstacles.push(obstacle);
        });
    }
    
    /**
     * Adiciona um objeto à cena
     * @param {THREE.Object3D} object - Objeto a ser adicionado
     */
    addObject(object) {
        this.scene.add(object);
    }
    
    /**
     * Remove um objeto da cena
     * @param {THREE.Object3D} object - Objeto a ser removido
     */
    removeObject(object) {
        this.scene.remove(object);
    }
    
    /**
     * Atualiza todos os elementos da cena (chamado a cada frame)
     * @param {number} deltaTime - Tempo desde o último frame em segundos
     */
    update(deltaTime) {
        // Contador para limitar atualizações
        if (!this.updateCounter) this.updateCounter = 0;
        this.updateCounter++;
        
        // Otimização: agora só atualiza a cada 5 frames para melhorar performance ainda mais
        if (this.updateCounter % 5 !== 0) return;
        
        // Tempo atual, calculado apenas uma vez por atualização
        const now = Date.now() * 0.001;
        
        // Animações de objetos na cena
        if (this.obstacles && this.obstacles.length > 0) {
            // Otimização: atualiza apenas 3 objetos por vez no máximo
            const startIdx = Math.floor(this.updateCounter / 5) % this.obstacles.length;
            const maxUpdateCount = Math.min(3, this.obstacles.length);
            
            for (let i = 0; i < maxUpdateCount; i++) {
                const idx = (startIdx + i) % this.obstacles.length;
                const obstacle = this.obstacles[idx];
                
                // Otimização: só anima objetos próximos à câmera
                if (this.camera) {
                    const distanceToCamera = obstacle.position.distanceTo(this.camera.position);
                    
                    // Se estiver longe demais, não perde tempo animando
                    if (distanceToCamera > 30) continue;
                    
                    // Animação reduzida para objetos distantes
                    const animationScale = distanceToCamera < 15 ? 1 : 0.5;
                    
                    // Exemplo: rotação lenta dos obstáculos
                    obstacle.rotation.y += 0.01 * deltaTime * animationScale;
                    
                    // Exemplo: movimento suave para cima e para baixo para alguns obstáculos
                    if (idx % 2 === 0) {
                        obstacle.position.y = 1 + Math.sin(now + idx) * 0.2 * animationScale;
                    }
                }
            }
        }
        
        // Animação de cores para as luzes de ponto - limite a apenas uma luz por atualização
        if (this.pointLights && this.pointLights.length > 0) {
            // Atualiza apenas uma luz por vez para melhorar performance
            const lightIndex = Math.floor(this.updateCounter / 5) % this.pointLights.length;
            const light = this.pointLights[lightIndex];
            
            // Otimização: só anima se a luz estiver próxima da câmera
            if (this.camera) {
                const distanceToCamera = light.position.distanceTo(this.camera.position);
                if (distanceToCamera < 25) {
                    // Altera lentamente a intensidade da luz
                    light.intensity = 0.7 + Math.sin(now + lightIndex) * 0.3;
                }
            }
        }
        
        // Debug: mostra informações na tela se o modo de depuração estiver ativo
        if (this.debugMode && this.fpsCounter % 120 === 0) { // Reduza ainda mais a frequência de logs
            console.log("FPS:", Math.round(1/deltaTime));
        }
        
        // Incrementa contador de frames
        this.fpsCounter = (this.fpsCounter || 0) + 1;
    }
    
    /**
     * Renderiza a cena
     */
    render() {
        if (this.renderer && this.scene && this.camera) {
            // Otimização: não renderiza se a página não estiver visível
            if (document.hidden) return;
            
            this.renderer.render(this.scene, this.camera);
        } else {
            console.error("SceneManager: Falha ao renderizar - componentes não inicializados");
        }
    }
    
    /**
     * Limpa a cena e libera recursos
     */
    dispose() {
        // Libera memória dos objetos da cena
        if (this.scene) {
            this.scene.traverse(object => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    }
} 