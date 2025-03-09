/**
 * Sistema de Gerenciamento de Missões
 * Responsável por criar, rastrear e atualizar o progresso das missões
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';
import { GAME } from './config.js';

export class MissionManager {
    /**
     * @param {Object} gameState - Referência ao estado do jogo
     * @param {Object} player - Referência ao jogador
     * @param {Object} uiManager - Referência ao gerenciador de UI para exibir objetivos
     */
    constructor(gameState, player, uiManager) {
        this.gameState = gameState;
        this.player = player;
        this.uiManager = uiManager;
        
        // Missões disponíveis
        this.missions = [];
        
        // Missão atual
        this.currentMission = null;
        
        // Estado das missões concluídas
        this.completedMissions = [];
        
        console.log("MissionManager inicializado");
    }
    
    /**
     * Carrega as missões da fase atual
     * @param {number} level - Número da fase
     */
    loadMissions(level) {
        // Limpa missões anteriores
        this.missions = [];
        this.currentMission = null;
        
        console.log(`Carregando missões da fase ${level}`);
        
        switch(level) {
            case 1:
                this.loadLevel1Missions();
                break;
            case 2:
                // Implementar no futuro
                console.log("Fase 2 ainda não implementada");
                break;
            default:
                console.warn(`Fase ${level} não encontrada`);
        }
        
        // Define a primeira missão como atual
        if (this.missions.length > 0) {
            this.setCurrentMission(0);
        }
        
        // Cria marcadores visuais para os objetivos
        this.createObjectiveMarkers();
    }
    
    /**
     * Carrega as missões da primeira fase
     */
    loadLevel1Missions() {
        const fase1 = {
            title: "Infiltração na Base Nebulosa",
            description: "Infiltre-se na instalação periférica da Corporação Nebulosa e desative suas operações.",
            missions: [
                {
                    id: "level1_mission1",
                    title: "Eliminar Sentinelas",
                    description: "Elimine 10 sentinelas (inimigos básicos de cor AZUL) para garantir acesso à instalação",
                    type: "kill",
                    target: "basic",
                    count: 10,
                    progress: 0,
                    completed: false,
                    reward: {
                        score: 500,
                        ammo: 30
                    }
                },
                {
                    id: "level1_mission2",
                    title: "Localizar Terminal",
                    description: "Encontre o terminal de acesso ao centro de comando",
                    type: "reach",
                    targetLocation: {x: 20, y: 0, z: 20},
                    radius: 3,
                    completed: false,
                    reward: {
                        score: 300
                    }
                },
                {
                    id: "level1_mission3",
                    title: "Defender Terminal",
                    description: "Defenda o terminal enquanto os dados são baixados",
                    type: "defend",
                    targetLocation: {x: 20, y: 0, z: 20},
                    radius: 10,
                    duration: 60, // segundos
                    timeRemaining: 60,
                    waves: 3,
                    completed: false,
                    reward: {
                        score: 1000,
                        ammo: 60
                    }
                },
                {
                    id: "level1_mission4",
                    title: "Eliminar Comandante",
                    description: "Elimine o comandante da instalação",
                    type: "kill",
                    target: "boss",
                    count: 1,
                    progress: 0,
                    completed: false,
                    reward: {
                        score: 2000,
                        health: 100
                    }
                },
                {
                    id: "level1_mission5",
                    title: "Escapar da Instalação",
                    description: "Chegue à zona de extração antes que a instalação seja destruída",
                    type: "reach",
                    targetLocation: {x: 0, y: 0, z: -30},
                    radius: 5,
                    timeLimit: 120, // segundos
                    timeRemaining: 120,
                    completed: false,
                    reward: {
                        score: 1500
                    }
                }
            ]
        };
        
        // Adiciona as missões à lista
        this.missions = fase1.missions;
        this.currentLevel = {
            number: 1,
            title: fase1.title,
            description: fase1.description
        };
        
        console.log(`Fase 1 "${fase1.title}" carregada com ${this.missions.length} missões`);
    }
    
    /**
     * Define a missão atual
     * @param {number} index - Índice da missão
     */
    setCurrentMission(index) {
        if (index >= 0 && index < this.missions.length) {
            this.currentMission = this.missions[index];
            
            // Atualiza a UI com a missão atual
            if (this.uiManager) {
                this.uiManager.showMessage(
                    `Nova missão: ${this.currentMission.title}`, 
                    5000, 
                    'info'
                );
                this.updateMissionUI();
                
                // Mostra tutorial específico para a primeira missão (sentinelas)
                if (this.currentMission.id === "level1_mission1") {
                    // Pequena espera para não sobrepor as mensagens
                    setTimeout(() => {
                        this.uiManager.showTutorial('sentinelas');
                        
                        // Destaca os sentinelas visualmente para facilitar identificação
                        this.highlightSentinels();
                        
                        // Também programa uma verificação periódica para destacar novos sentinelas
                        this.sentinelHighlightInterval = setInterval(() => {
                            this.highlightSentinels();
                        }, 5000); // A cada 5 segundos verifica novos sentinelas
                    }, 6000);
                }
                // Tutorial para a segunda missão (terminal)
                else if (this.currentMission.id === "level1_mission2") {
                    setTimeout(() => {
                        this.uiManager.showTutorial('terminal');
                    }, 6000);
                }
                // Tutorial para a quarta missão (boss)
                else if (this.currentMission.id === "level1_mission4") {
                    setTimeout(() => {
                        this.uiManager.showTutorial('boss');
                    }, 6000);
                }
            }
            
            console.log(`Missão atual: ${this.currentMission.title}`);
            return true;
        }
        return false;
    }
    
    /**
     * Avança para a próxima missão
     * @returns {boolean} - Se conseguiu avançar com sucesso
     */
    advanceToNextMission() {
        // Encontra o índice da missão atual
        const currentIndex = this.missions.findIndex(m => m.id === this.currentMission.id);
        
        // Limpa intervalos da missão anterior
        if (this.sentinelHighlightInterval) {
            clearInterval(this.sentinelHighlightInterval);
            this.sentinelHighlightInterval = null;
        }
        
        // Tenta definir a próxima missão
        if (currentIndex < this.missions.length - 1) {
            const nextMission = this.missions[currentIndex + 1];
            
            // Verifica se a próxima missão é a de derrotar o boss
            if (nextMission.id === "level1_mission4") {
                // Cria o boss para a missão
                this.spawnBossForMission();
            }
            
            return this.setCurrentMission(currentIndex + 1);
        } else {
            console.log("Todas as missões da fase foram concluídas!");
            this.onLevelCompleted();
            return false;
        }
    }
    
    /**
     * Cria o boss para a missão de derrotar o comandante
     */
    spawnBossForMission() {
        // Verifica se o enemyManager está disponível
        if (window.game && window.game.enemyManager) {
            // Cria o boss em uma posição próxima ao terminal
            const bossPosition = new THREE.Vector3(
                this.missions[2].targetLocation.x + 10, // Um pouco afastado do terminal
                0,
                this.missions[2].targetLocation.z + 10
            );
            
            // Spawn do boss
            window.game.enemyManager.spawnBoss(bossPosition);
            
            // Mensagem ao jogador
            if (window.game.uiManager) {
                window.game.uiManager.showMessage(
                    "Comandante inimigo detectado! Elimine-o para obter os dados estratégicos.",
                    6000,
                    'warning'
                );
            }
        } else {
            console.error("EnemyManager não disponível para criar o boss!");
        }
    }
    
    /**
     * Chamado quando todas as missões da fase são concluídas
     */
    onLevelCompleted() {
        if (this.gameState) {
            // Recompensa por concluir a fase
            this.gameState.addScore(5000);
            
            // Atualiza UI
            if (this.uiManager) {
                this.uiManager.showMessage(
                    `Fase ${this.currentLevel.number} concluída! +5000 pontos`, 
                    8000, 
                    'success'
                );
            }
            
            // Aqui poderíamos avançar para a próxima fase
            console.log(`Fase ${this.currentLevel.number} concluída!`);
        }
    }
    
    /**
     * Atualiza o progresso da missão atual
     * @param {Object} updateData - Dados para atualização (depende do tipo de missão)
     */
    updateMissionProgress(updateData) {
        if (!this.currentMission) return;
        
        switch (this.currentMission.type) {
            case 'kill':
                this.updateKillMission(updateData);
                break;
                
            case 'reach':
                this.updateReachMission(updateData);
                break;
                
            case 'defend':
                this.updateDefendMission(updateData);
                break;
                
            default:
                console.warn(`Tipo de missão não implementado: ${this.currentMission.type}`);
        }
        
        // Atualiza a UI
        this.updateMissionUI();
    }
    
    /**
     * Atualiza o progresso de uma missão do tipo 'kill'
     * @param {Object} data - Dados do inimigo eliminado
     */
    updateKillMission(data) {
        const { enemyType } = data;
        
        if (this.currentMission.target === enemyType) {
            this.currentMission.progress++;
            
            // Verifica se a missão foi concluída
            if (this.currentMission.progress >= this.currentMission.count) {
                this.completeMission();
            } else {
                // Atualiza a UI com o progresso
                if (this.uiManager) {
                    this.uiManager.showMessage(
                        `Progresso da missão: ${this.currentMission.progress}/${this.currentMission.count}`,
                        2000,
                        'info'
                    );
                }
            }
        }
    }
    
    /**
     * Atualiza o progresso de uma missão do tipo 'reach'
     * @param {Object} data - Posição atual do jogador
     */
    updateReachMission(data) {
        const { playerPosition } = data;
        
        // Calcula a distância entre o jogador e o alvo
        const targetLocation = this.currentMission.targetLocation;
        const dx = targetLocation.x - playerPosition.x;
        const dz = targetLocation.z - playerPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Verifica se o jogador chegou ao alvo
        if (distance <= this.currentMission.radius) {
            this.completeMission();
        }
    }
    
    /**
     * Atualiza o progresso de uma missão do tipo 'defend'
     * @param {Object} data - Dados de tempo e inimigos
     */
    updateDefendMission(data) {
        const { deltaTime, playerPosition } = data;
        
        // Verifica se o jogador está dentro da área de defesa
        const targetLocation = this.currentMission.targetLocation;
        const dx = targetLocation.x - playerPosition.x;
        const dz = targetLocation.z - playerPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Se o jogador sair da área, a missão falha
        if (distance > this.currentMission.radius) {
            if (this.uiManager) {
                this.uiManager.showMessage(
                    "Você deixou a área de defesa! Retorne imediatamente.",
                    3000,
                    'warning'
                );
            }
            return;
        }
        
        // Reduz o tempo restante
        this.currentMission.timeRemaining -= deltaTime;
        
        // Atualiza a UI a cada segundo inteiro
        if (Math.floor(this.currentMission.timeRemaining) < Math.floor(this.currentMission.timeRemaining + deltaTime)) {
            this.updateMissionUI();
        }
        
        // Verifica se o tempo acabou
        if (this.currentMission.timeRemaining <= 0) {
            this.completeMission();
        }
    }
    
    /**
     * Marca a missão atual como concluída
     */
    completeMission() {
        if (!this.currentMission) return;
        
        this.currentMission.completed = true;
        this.completedMissions.push(this.currentMission.id);
        
        // Aplica recompensas
        this.applyRewards(this.currentMission.reward);
        
        // Notifica o jogador
        if (this.uiManager) {
            this.uiManager.showMessage(
                `Missão concluída: ${this.currentMission.title}`,
                5000,
                'success'
            );
        }
        
        console.log(`Missão concluída: ${this.currentMission.title}`);
        
        // Avança para a próxima missão
        setTimeout(() => {
            this.advanceToNextMission();
        }, 2000);
    }
    
    /**
     * Aplica as recompensas ao jogador
     * @param {Object} reward - Recompensas para aplicar
     */
    applyRewards(reward) {
        if (!reward) return;
        
        // Adiciona pontuação
        if (reward.score && this.gameState) {
            this.gameState.addScore(reward.score);
        }
        
        // Adiciona munição
        if (reward.ammo && this.player) {
            this.player.addAmmo(reward.ammo);
            
            if (this.uiManager) {
                this.uiManager.showMessage(
                    `+${reward.ammo} munição`,
                    3000,
                    'info'
                );
            }
        }
        
        // Recupera saúde
        if (reward.health && this.player) {
            this.player.heal(reward.health);
            
            if (this.uiManager) {
                this.uiManager.showMessage(
                    `+${reward.health} saúde`,
                    3000,
                    'info'
                );
            }
        }
    }
    
    /**
     * Atualiza a interface com informações da missão atual
     */
    updateMissionUI() {
        if (!this.uiManager || !this.currentMission) return;
        
        let missionText = `${this.currentMission.title}: ${this.currentMission.description}`;
        
        // Adiciona informações de progresso específicas para cada tipo de missão
        switch (this.currentMission.type) {
            case 'kill':
                missionText += ` (${this.currentMission.progress}/${this.currentMission.count})`;
                break;
                
            case 'defend':
            case 'reach':
                if (this.currentMission.timeRemaining) {
                    const seconds = Math.ceil(this.currentMission.timeRemaining);
                    missionText += ` (${seconds}s)`;
                }
                break;
        }
        
        // Atualiza o elemento de missão na UI
        const missionElement = document.getElementById('mission-text');
        if (missionElement) {
            missionElement.textContent = missionText;
        }
    }
    
    /**
     * Atualiza o gerenciador de missões
     * @param {number} deltaTime - Tempo desde o último frame
     */
    update(deltaTime) {
        if (!this.currentMission || !this.player) return;
        
        // Atualiza o progresso baseado no tipo de missão
        const playerPosition = this.player.position;
        
        switch (this.currentMission.type) {
            case 'reach':
                this.updateReachMission({ playerPosition });
                
                // Mostrar distância até o objetivo a cada 3 segundos
                if (!this.reachDistanceTimer) this.reachDistanceTimer = 0;
                this.reachDistanceTimer += deltaTime;
                
                if (this.reachDistanceTimer >= 3) {
                    this.reachDistanceTimer = 0;
                    
                    // Calcula a distância até o objetivo
                    const target = this.currentMission.targetLocation;
                    const dx = target.x - playerPosition.x;
                    const dz = target.z - playerPosition.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    // Mostra a distância no HUD
                    if (this.uiManager) {
                        this.uiManager.showMessage(
                            `Distância até o objetivo: ${Math.round(distance)}m`, 
                            1500, 
                            'info'
                        );
                    }
                }
                break;
                
            case 'defend':
                this.updateDefendMission({ deltaTime, playerPosition });
                break;
                
            case 'kill':
                // Atualiza o número de inimigos restantes a cada 5 segundos
                if (!this.killReminderTimer) this.killReminderTimer = 0;
                this.killReminderTimer += deltaTime;
                
                if (this.killReminderTimer >= 5) {
                    this.killReminderTimer = 0;
                    
                    // Mostra o progresso da missão
                    const remaining = this.currentMission.count - this.currentMission.progress;
                    if (remaining > 0 && this.uiManager) {
                        this.uiManager.showMessage(
                            `Sentinelas restantes: ${remaining}`, 
                            2000, 
                            'info'
                        );
                    }
                }
                break;
        }
        
        // Anima os marcadores visíveis
        this.updateMarkerAnimations(deltaTime);
    }
    
    /**
     * Atualiza as animações dos marcadores visíveis
     * @param {number} deltaTime - Tempo desde o último frame
     */
    updateMarkerAnimations(deltaTime) {
        if (!this.markers) return;
        
        // Atualiza apenas os marcadores visíveis
        this.markers.forEach(marker => {
            if (marker.isVisible && marker.mesh.userData.update) {
                marker.mesh.userData.update(deltaTime);
            }
        });
    }
    
    /**
     * Cria marcadores visuais para os objetivos
     */
    createObjectiveMarkers() {
        console.log("Criando marcadores para objetivos");
        this.markers = [];
        
        // Verifica se a SceneManager está disponível
        if (!window.game || !window.game.sceneManager || !window.game.sceneManager.scene) {
            console.error("SceneManager não disponível para criar marcadores!");
            return;
        }
        
        const scene = window.game.sceneManager.scene;
        console.log("SceneManager disponível, scene:", !!scene);
        
        // Verificando se temos missões carregadas
        if (!this.missions || this.missions.length === 0) {
            console.error("Nenhuma missão carregada para criar marcadores!");
            return;
        }
        
        console.log(`Criando marcadores para ${this.missions.length} missões`);
        
        // Criando marcadores para missões do tipo 'reach'
        this.missions.forEach(mission => {
            if (mission.type === 'reach' || mission.type === 'defend') {
                console.log(`Criando marcador para missão ${mission.id} na posição:`, mission.targetLocation);
                
                try {
                    // Cria um marcador para a localização alvo
                    const marker = this.createMarker(mission.targetLocation, mission.id);
                    
                    // Adiciona à cena e à lista de marcadores
                    scene.add(marker);
                    this.markers.push({
                        id: mission.id,
                        mesh: marker,
                        isVisible: false
                    });
                    console.log(`Marcador criado com sucesso para ${mission.id}`);
                } catch (error) {
                    console.error(`Erro ao criar marcador para ${mission.id}:`, error);
                }
            }
        });
        
        // Atualiza a visibilidade dos marcadores
        this.updateMarkersVisibility();
        console.log(`Total de ${this.markers.length} marcadores criados`);
    }
    
    /**
     * Cria um marcador visual 3D
     * @param {Object} location - Localização {x, y, z}
     * @param {string} id - Identificador do marcador
     * @returns {THREE.Object3D} - O objeto 3D do marcador
     */
    createMarker(location, id) {
        // Cores diferentes conforme o tipo de missão
        let color;
        if (id === 'level1_mission2') {
            color = 0x00ffff; // Azul ciano para o terminal
        } else if (id === 'level1_mission5') {
            color = 0x00ff00; // Verde para extração
        } else {
            color = 0xffff00; // Amarelo para outros objetivos
        }
        
        // Cria um grupo para o marcador
        const markerGroup = new THREE.Group();
        markerGroup.position.set(location.x, 0, location.z);
        
        // Base do marcador (cilindro)
        const baseGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 16);
        const baseMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.1;
        markerGroup.add(base);
        
        // Pilar luminoso (cilindro fino e alto)
        const pillarGeometry = new THREE.CylinderGeometry(0.2, 0.2, 10, 8);
        const pillarMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 });
        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.y = 5;
        markerGroup.add(pillar);
        
        // Topo do marcador (esfera)
        const topGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const topMaterial = new THREE.MeshBasicMaterial({ color: color });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 10;
        markerGroup.add(top);
        
        // Adiciona animação
        this.addMarkerAnimation(markerGroup);
        
        return markerGroup;
    }
    
    /**
     * Adiciona animação ao marcador
     * @param {THREE.Object3D} marker - O marcador a animar
     */
    addMarkerAnimation(marker) {
        // Guarda a posição Y inicial do topo
        const initialTopY = marker.children[2].position.y;
        
        // Função de animação que será chamada a cada frame
        marker.userData.update = (deltaTime) => {
            // Faz o topo subir e descer
            const time = Date.now() * 0.001;
            marker.children[2].position.y = initialTopY + Math.sin(time * 2) * 0.5;
            
            // Faz o marcador girar
            marker.rotation.y += deltaTime * 0.5;
        };
    }
    
    /**
     * Atualiza a visibilidade dos marcadores com base na missão atual
     */
    updateMarkersVisibility() {
        if (!this.markers || !this.currentMission) return;
        
        this.markers.forEach(marker => {
            // Compara o ID da missão associada ao marcador com a missão atual
            const shouldBeVisible = marker.id === this.currentMission.id;
            
            // Se o status da visibilidade mudou, atualiza
            if (marker.isVisible !== shouldBeVisible) {
                marker.mesh.visible = shouldBeVisible;
                marker.isVisible = shouldBeVisible;
            }
        });
    }
    
    /**
     * Adiciona efeito visual de silhueta aos sentinelas para facilitar a identificação
     */
    highlightSentinels() {
        // Verifica se o enemyManager está disponível
        if (!window.game || !window.game.enemyManager) {
            console.error("EnemyManager não disponível para destacar sentinelas!");
            return;
        }
        
        // Percorre a lista de inimigos para encontrar os sentinelas (tipo basic)
        console.log("Destacando sentinelas para facilitar identificação");
        
        window.game.enemyManager.enemies.forEach(enemy => {
            if (enemy.type === 'basic' && enemy.mesh) {
                try {
                    // Adiciona um outline (borda) ao redor do inimigo, se já não tiver
                    if (!enemy.outlineAdded) {
                        // Cria uma cópia da geometria mas um pouco maior
                        const outlineGeometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
                        const outlineMaterial = new THREE.MeshBasicMaterial({
                            color: 0x00ffff,
                            side: THREE.BackSide,
                            transparent: true,
                            opacity: 0.6
                        });
                        
                        // Cria a malha de contorno
                        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
                        enemy.mesh.add(outline);
                        
                        // Adiciona um efeito pulsante
                        const pulsateOutline = () => {
                            const time = Date.now() * 0.001;
                            const scale = 1.1 + Math.sin(time * 3) * 0.05;
                            outline.scale.set(scale, scale, scale);
                            
                            requestAnimationFrame(pulsateOutline);
                        };
                        pulsateOutline();
                        
                        // Marca o inimigo como tendo outline
                        enemy.outlineAdded = true;
                    }
                } catch (error) {
                    console.error("Erro ao adicionar outline ao sentinela:", error);
                }
            }
        });
    }
} 