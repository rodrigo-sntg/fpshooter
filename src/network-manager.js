/**
 * Gerenciador de rede para conexões multiplayer
 * Responsável pela comunicação entre cliente e servidor via WebSockets
 */
import { PLAYER } from './config.js';

export class NetworkManager {
    /**
     * Inicializa o gerenciador de rede
     * @param {Object} gameState - Referência ao estado do jogo
     * @param {Object} player - Referência ao jogador local
     */
    constructor(gameState, player) {
        // Referências
        this.gameState = gameState;
        this.player = player;
        
        // Estado da conexão
        this.connected = false;
        this.connecting = false;
        this.serverUrl = null;
        this.socket = null;
        this.playerId = null;
        this.authToken = null;
        this.latency = 0;
        
        // Estado do jogo remoto
        this.remotePlayers = new Map(); // id -> playerObject
        this.remoteProjectiles = new Map(); // id -> projectileObject
        
        // Input prediction
        this.pendingInputs = [];
        this.sequenceNumber = 0;
        
        // Timestamp para cálculo de latência
        this.lastPingTime = 0;
        this.pingInterval = null;
        
        // UI update
        this.uiUpdateTimer = null;
        
        console.log("NetworkManager: Inicializado");
    }
    
    /**
     * Conecta ao servidor multiplayer
     * @param {string} serverUrl - URL do servidor WebSocket
     * @param {string} authToken - Token de autenticação (opcional)
     * @param {string} playerName - Nome do jogador (opcional)
     * @returns {Promise} - Promise que resolve quando conectado ou rejeita em caso de erro
     */
    connect(serverUrl, authToken = null, playerName = null) {
        if (this.connected || this.connecting) {
            console.warn("NetworkManager: Já está conectado ou conectando");
            return Promise.reject("Já conectado ou tentando conectar");
        }
        
        this.connecting = true;
        this.serverUrl = serverUrl;
        this.authToken = authToken;
        this.playerName = playerName || "Jogador" + Math.floor(Math.random() * 1000);
        
        console.log(`NetworkManager: Conectando ao servidor ${serverUrl} como "${this.playerName}"`);
        
        return new Promise((resolve, reject) => {
            try {
                // Limpa quaisquer timeouts e intervalos existentes
                this._clearPingInterval();
                this._clearConnectionTimeout();
                
                // Constrói a URL completa com token se fornecido
                const fullUrl = authToken 
                    ? `${serverUrl}?token=${authToken}`
                    : serverUrl;
                
                // Cria a conexão WebSocket
                this.socket = new WebSocket(fullUrl);
                
                // Configura os handlers de eventos
                this.socket.onopen = () => this._handleOpen(resolve);
                this.socket.onmessage = (event) => this._handleMessage(event);
                this.socket.onclose = (event) => this._handleClose(event);
                this.socket.onerror = (error) => this._handleError(error, reject);
                
                // Timeout para falha na conexão
                this.connectionTimeout = setTimeout(() => {
                    if (this.connecting) {
                        this.socket.close();
                        this.connecting = false;
                        reject(new Error("Tempo de conexão esgotado"));
                    }
                }, 10000); // 10 segundos de timeout
            } catch (error) {
                this.connecting = false;
                reject(error);
            }
        });
    }
    
    /**
     * Desconecta do servidor
     */
    disconnect() {
        if (!this.socket) return;
        
        console.log("NetworkManager: Desconectando do servidor");
        
        // Limpa os timers antes de desconectar
        this._clearPingInterval();
        this._clearConnectionTimeout();
        
        // Fecha a conexão
        try {
            // Envia mensagem de desconexão
            if (this.connected) {
                this._sendMessage('disconnect', { reason: 'client_disconnect' });
            }
            
            // Fecha o socket
            this.socket.close();
        } catch (e) {
            console.error("Erro ao fechar a conexão:", e);
        }
        
        // Reseta o estado
        this.connected = false;
        this.connecting = false;
        this.lastPingTime = null;
        
        // Limpa callbacks
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket = null;
        
        console.log("NetworkManager: Desconectado do servidor");
    }
    
    /**
     * Envia movimento do jogador para o servidor
     * @param {THREE.Vector3} position - Posição do jogador
     * @param {THREE.Vector3} velocity - Velocidade do jogador
     * @param {THREE.Euler} rotation - Rotação da câmera
     */
    sendPlayerUpdate(position, velocity, rotation) {
        if (!this.connected || !this.socket) return;
        
        const input = {
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            velocity: {
                x: velocity.x,
                y: velocity.y,
                z: velocity.z
            },
            rotation: {
                x: rotation.x,
                y: rotation.y,
                z: rotation.z
            },
            sequence: this.sequenceNumber++
        };
        
        // Armazena para client prediction
        this.pendingInputs.push(input);
        
        // Limita o tamanho da lista
        if (this.pendingInputs.length > 60) {
            this.pendingInputs.shift();
        }
        
        // Envia ao servidor
        this._sendMessage('input', input);
    }
    
    /**
     * Envia informação de tiro para o servidor
     * @param {THREE.Vector3} position - Posição inicial do projétil
     * @param {THREE.Vector3} direction - Direção do projétil
     */
    sendShoot(position, direction) {
        if (!this.connected || !this.socket) return;
        
        this._sendMessage('action', {
            action: 'shoot',
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            direction: {
                x: direction.x,
                y: direction.y,
                z: direction.z
            }
        });
    }
    
    /**
     * Envia ping para medir latência
     */
    sendPing() {
        if (!this.connected) {
            console.warn("Tentativa de enviar ping sem conexão ativa");
            return;
        }
        
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn("Socket não está aberto para enviar ping");
            // Se o socket não estiver no estado OPEN, tenta reconectar
            if (this.socket && this.socket.readyState === WebSocket.CLOSED) {
                console.warn("Socket fechado, possível desconexão não detectada");
                this.connected = false;
            }
            return;
        }
        
        try {
            this.lastPingTime = Date.now();
            this._sendMessage('ping', { 
                timestamp: this.lastPingTime,
                clientId: this.playerId // Incluir ID do cliente para ajudar o servidor a rastrear
            });
        } catch (error) {
            console.error("Erro ao enviar ping:", error);
        }
    }
    
    /**
     * Processa atualizações de estado recebidas do servidor
     * @param {Object} update - Dados da atualização
     */
    processServerUpdate(update) {
        if (!update || !update.players) return;
        
        // Decidir se deve registrar logs com base na contagem de frames
        const shouldLog = Math.random() < 0.001; // Log apenas 0.1% das atualizações
        
        if (shouldLog) {
            console.log(`Recebendo atualização do servidor com ${Object.keys(update.players).length} jogadores`);
        }
        
        // Atualizar cada jogador remoto
        Object.entries(update.players).forEach(([playerId, playerData]) => {
            // Ignorar nosso próprio jogador
            if (playerId === this.playerId) return;
            
            // Atualizar o jogador remoto
            this.updateRemotePlayer(playerId, playerData);
            
            if (shouldLog) {
                console.log(`Atualizando jogador remoto: ${playerId} na posição: ${JSON.stringify(playerData.position)}`);
            }
        });
        
        // Processar projéteis
        if (update.projectiles && Array.isArray(update.projectiles)) {
            // Só logar projéteis raramente
            if (shouldLog && update.projectiles.length > 0) {
                console.log(`Recebendo ${update.projectiles.length} projéteis do servidor`);
            }
            
            this._updateRemoteProjectiles(update.projectiles);
        }
    }
    
    /**
     * Atualiza um jogador remoto ou cria se não existir
     * @param {string} playerId - ID do jogador
     * @param {Object} playerData - Dados do jogador
     */
    updateRemotePlayer(playerId, playerData) {
        try {
            // Ignorar nosso próprio jogador
            if (playerId === this.playerId) {
                return;
            }
            
            // Verificar se os dados são válidos
            if (!playerData || !playerData.position) {
                console.warn(`Ignorando dados inválidos para jogador remoto [${playerId}]`);
                return;
            }
            
            // Verificar se o jogador remoto já existe
            if (window.game.remotePlayers.has(playerId)) {
                // Jogador existente - atualiza
                const remotePlayer = window.game.remotePlayers.get(playerId);
                
                // Verificar se o objeto remotePlayer é válido
                if (remotePlayer && typeof remotePlayer.updateFromNetworkData === 'function') {
                    remotePlayer.updateFromNetworkData(playerData);
                } else {
                    console.warn(`Jogador remoto [${playerId}] inválido, recriando`);
                    window.game.remotePlayers.delete(playerId);
                    window.game._createRemotePlayer(playerId, playerData);
                }
            } else {
                // Novo jogador - cria
                console.log(`Criando novo jogador remoto [${playerId}]`);
                const newPlayer = window.game._createRemotePlayer(playerId, playerData);
                
                // Verificar se o jogador foi criado com sucesso
                if (!newPlayer) {
                    console.error(`Falha ao criar jogador remoto [${playerId}]`);
                }
            }
        } catch (error) {
            console.error(`Erro ao atualizar jogador remoto [${playerId}]:`, error);
        }
    }
    
    /**
     * Atualiza o gerenciador de rede (chamado a cada frame)
     * @param {number} deltaTime - Tempo desde o último frame
     */
    update(deltaTime) {
        if (!this.connected) return;
        
        // Atualiza a posição do jogador no servidor em intervalos
        if (this.player && this.updateTimer <= 0) {
            this.sendPlayerUpdate(
                this.player.position,
                this.player.velocity,
                this.player.rotation
            );
            
            // Redefine o temporizador (10 atualizações por segundo)
            this.updateTimer = 0.1;
            
            // Atualiza a lista de jogadores na UI a cada segundo
            if (window.game && window.game.uiManager) {
                // Apenas atualiza a cada segundo aproximadamente
                if (!this.uiUpdateTimer || this.uiUpdateTimer <= 0) {
                    const playersList = [];
                    
                    // Adiciona o jogador local
                    playersList.push({
                        id: this.playerId || 'local',
                        name: 'Você',
                        latency: this.latency,
                        isLocal: true
                    });
                    
                    // Adiciona jogadores remotos
                    this.remotePlayers.forEach((player, id) => {
                        playersList.push({
                            id,
                            name: player.name || `Jogador ${id}`,
                            latency: 0, // Sem informação de latência de outros jogadores
                            isLocal: false
                        });
                    });
                    
                    // Atualiza a UI
                    window.game.uiManager.updatePlayersList(playersList);
                    
                    // Redefine o timer (atualizar a cada segundo)
                    this.uiUpdateTimer = 1.0;
                } else {
                    this.uiUpdateTimer -= deltaTime;
                }
            }
        } else {
            this.updateTimer -= deltaTime;
        }
        
        // Atualiza projéteis remotos
        this.remoteProjectiles.forEach(projectile => {
            if (projectile.update) {
                projectile.update(deltaTime);
            }
        });
    }
    
    /**
     * Manipula o evento de abertura da conexão
     * @private
     * @param {Function} resolvePromise - Função para resolver a promessa de conexão
     */
    _handleOpen(resolvePromise) {
        console.log("Conectado ao servidor!");
        
        this.connected = true;
        this.connecting = false;
        
        // Limpa o timeout de conexão
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Configura o timeout de verificação de saúde da conexão
        this._setupConnectionTimeout();
        
        // Inicializa os timestamps para controle de latência
        this.lastPingTime = null;
        this.latency = 0;
        
        // Envia autenticação
        this._sendMessage('auth', {
            playerId: this.playerId,
            playerName: this.playerName
        });
        
        // Resolve a promessa
        resolvePromise();
    }
    
    /**
     * Manipula o evento de fechamento da conexão
     * @private
     * @param {CloseEvent} event - Evento de fechamento
     */
    _handleClose(event) {
        const wasConnected = this.connected;
        
        // Atualiza o estado
        this.connected = false;
        this.connecting = false;
        
        // Limpa os timers
        this._clearPingInterval();
        this._clearConnectionTimeout();
        
        let reason = "Conexão fechada";
        if (event.code) {
            reason += ` (código: ${event.code})`;
        }
        if (event.reason) {
            reason += `: ${event.reason}`;
        }
        
        console.log(`NetworkManager: Desconectado do servidor: ${reason}`);
        
        // Notifica apenas se estava conectado anteriormente
        if (wasConnected) {
            // Notifica o jogo
            if (this.onDisconnect) {
                this.onDisconnect(reason);
            }
            
            // Atualiza a UI
            if (window.game && window.game.uiManager) {
                window.game.uiManager.showMessage(`Desconectado do servidor: ${reason}`, 5000, "warning");
                
                if (typeof window.game.uiManager.updateNetworkStatus === 'function') {
                    window.game.uiManager.updateNetworkStatus(false);
                }
            }
        }
    }
    
    /**
     * Trata erros de conexão WebSocket
     * @private
     * @param {Event} error - Evento de erro
     * @param {Function} rejectPromise - Função para rejeitar a promessa de conexão
     */
    _handleError(error, rejectPromise) {
        // Formata a mensagem de erro para ser mais informativa
        let errorMessage = "Erro de conexão";
        
        if (error) {
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error.message) {
                errorMessage = error.message;
            } else {
                errorMessage = "Erro desconhecido na conexão WebSocket";
            }
        }
        
        console.error(`NetworkManager: Erro de WebSocket - ${errorMessage}`, error);
        
        // Limpa o timeout de conexão se existir
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Rejeita a promessa se ainda estiver conectando
        if (this.connecting && rejectPromise) {
            this.connecting = false;
            rejectPromise(new Error(errorMessage));
        }
        
        // Notifica o jogo sobre o erro
        if (window.game && window.game.uiManager) {
            window.game.uiManager.showMessage(`Erro de rede: ${errorMessage}`, 5000, "error");
        }
        
        // Tenta fechar a conexão se ainda estiver aberta
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            try {
                this.socket.close();
            } catch (closeError) {
                console.warn("Erro ao fechar socket após falha:", closeError);
            }
        }
        
        // Reseta o estado da conexão
        this.connected = false;
        this.connecting = false;
    }
    
    /**
     * Envia uma mensagem para o servidor
     * @private
     * @param {string} type - Tipo da mensagem
     * @param {Object} data - Dados da mensagem
     * @returns {boolean} - Sucesso do envio
     */
    _sendMessage(type, data) {
        if (!this.connected) {
            console.warn(`NetworkManager: Tentativa de enviar mensagem '${type}' sem conexão ativa`);
            return false;
        }
        
        if (!this.socket) {
            console.warn(`NetworkManager: Socket não inicializado para enviar mensagem '${type}'`);
            return false;
        }
        
        // Verifica se o socket está realmente aberto
        if (this.socket.readyState !== WebSocket.OPEN) {
            const stateMap = {
                0: "CONNECTING",
                1: "OPEN",
                2: "CLOSING", 
                3: "CLOSED"
            };
            console.warn(`NetworkManager: Socket não está no estado OPEN para enviar mensagem '${type}', estado atual: ${stateMap[this.socket.readyState]}`);
            
            // Se estiver fechado, atualize o estado interno
            if (this.socket.readyState === WebSocket.CLOSED) {
                this.connected = false;
            }
            
            return false;
        }
        
        try {
            const message = JSON.stringify({
                type,
                data
            });
            
            this.socket.send(message);
            return true;
        } catch (error) {
            console.error(`NetworkManager: Erro ao enviar mensagem ${type}`, error);
            return false;
        }
    }
    
    /**
     * Cria um jogador remoto
     * @private
     * @param {string} id - ID do jogador
     * @param {Object} data - Dados do jogador
     */
    _createRemotePlayer(id, data) {
        // Verifica se o jogador remoto já existe
        if (this.remotePlayers.has(id)) {
            console.log(`NetworkManager: Jogador remoto [${id}] já existe. Atualizando dados.`);
            const remotePlayer = this.remotePlayers.get(id);
            remotePlayer.updateFromNetworkData(data);
            return;
        }
        
        console.log(`NetworkManager: Criando jogador remoto [${id}] com dados:`, JSON.stringify(data));
        
        // Obtém a referência da cena através da janela global
        const scene = window.game?.sceneManager?.scene;
        if (!scene) {
            console.error("NetworkManager: Cena não disponível. Impossível criar jogador remoto.");
            return;
        }
        
        console.log("NetworkManager: Cena encontrada, instanciando RemotePlayer");
        console.log("NetworkManager: window.RemotePlayer disponível:", !!window.RemotePlayer);
        
        try {
            // Usando a classe RemotePlayer para criar um jogador remoto visualmente
            const remotePlayer = new window.RemotePlayer(id, data, scene);
            
            console.log(`NetworkManager: RemotePlayer [${id}] criado com sucesso:`, remotePlayer);
            
            // Adiciona ao mapa de jogadores remotos
            this.remotePlayers.set(id, remotePlayer);
            
            // Notifica a criação de um novo jogador
            if (this.onPlayerJoined) {
                this.onPlayerJoined(remotePlayer);
            }
            
            // Atualiza a UI para mostrar o novo jogador
            if (window.game && window.game.uiManager) {
                window.game.uiManager.showMessage(`Jogador ${id} entrou no jogo`, 3000, "info");
                
                // Força atualização da lista de jogadores
                const playersList = [];
                playersList.push({
                    id: this.playerId || 'local',
                    name: 'Você',
                    latency: this.latency,
                    isLocal: true
                });
                
                this.remotePlayers.forEach((player, playerId) => {
                    playersList.push({
                        id: playerId,
                        name: player.name || `Jogador ${playerId}`,
                        latency: 0,
                        isLocal: false
                    });
                });
                
                window.game.uiManager.updatePlayersList(playersList);
            }
            
            console.log(`NetworkManager: Jogador remoto [${id}] criado com sucesso!`);
        } catch (error) {
            console.error(`NetworkManager: Erro ao criar jogador remoto [${id}]:`, error);
        }
    }
    
    /**
     * Cria ou atualiza um projétil remoto
     * @private
     * @param {string} id - ID do projétil
     * @param {Object} data - Dados do projétil
     */
    _createOrUpdateRemoteProjectile(id, data) {
        if (!this.remoteProjectiles) {
            this.remoteProjectiles = new Map();
        }
        
        // Verifica se o projétil já existe
        if (this.remoteProjectiles.has(id)) {
            // Atualiza o projétil existente
            const projectile = this.remoteProjectiles.get(id);
            
            if (projectile && projectile.position && data.position) {
                projectile.position.set(
                    data.position.x,
                    data.position.y,
                    data.position.z
                );
            }
        } else {
            // Cria um novo projétil se window.game estiver disponível
            if (window.game && window.game.scene) {
                // Usa a classe Bullet se disponível
                if (window.game.createRemoteProjectile) {
                    const projectile = window.game.createRemoteProjectile(data);
                    if (projectile) {
                        this.remoteProjectiles.set(id, projectile);
                    }
                }
            }
        }
    }
    
    /**
     * Implementação da reconciliação de estado do jogador local
     * @private
     * @param {Object} serverState - Estado do jogador no servidor
     */
    _reconcilePlayerState(serverState) {
        // Apenas para o jogador local
        if (!this.player) return;
        
        // Se não houver dados de posição, não faz nada
        if (!serverState || !serverState.position) return;
        
        // A cada ~5 segundos (ou aproximadamente 2% das atualizações),
        // fazemos um log da distância entre a posição local e a do servidor
        if (Math.random() < 0.02) {
            const localPos = this.player.position;
            const serverPos = serverState.position;
            
            const dx = localPos.x - serverPos.x;
            const dy = localPos.y - serverPos.y;
            const dz = localPos.z - serverPos.z;
            
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            console.log(`Diferença entre posição local e servidor: ${distance.toFixed(2)} unidades`);
            
            // Se a distância for significativa (mais de 2 unidades), 
            // podemos aplicar uma pequena correção
            if (distance > 2) {
                console.log(`Corrigindo posição local para mais próxima do servidor`);
                
                // Correção suave - move 10% na direção do servidor
                this.player.position.x += (serverPos.x - localPos.x) * 0.1;
                this.player.position.y += (serverPos.y - localPos.y) * 0.1;
                this.player.position.z += (serverPos.z - localPos.z) * 0.1;
            }
        }
    }
    
    /**
     * Solicita a lista de jogadores ativos ao servidor
     */
    requestPlayersList() {
        if (!this.connected || !this.socket) return;
        
        console.log("Solicitando lista de jogadores ao servidor...");
        this._sendMessage('getPlayers', {});
    }

    /**
     * Inicia o envio periódico de pings para o servidor
     * @private
     */
    _startPingInterval() {
        // Limpa qualquer intervalo existente
        this._clearPingInterval();
        
        // Define intervalo para enviar pings a cada 3 segundos
        // Reduzido de 5s para 3s para garantir resposta mais frequente ao servidor
        this.pingInterval = setInterval(() => {
            if (this.connected && this.socket) {
                console.log("Enviando ping para o servidor");
                this.sendPing();
                
                // Verifica se houve resposta ao último ping
                if (this.lastPingTime && (Date.now() - this.lastPingTime > 10000)) {
                    console.warn("Servidor não respondeu ao último ping há mais de 10 segundos");
                    this.lastPingTime = Date.now(); // Reinicia o contador para evitar múltiplos avisos
                }
            } else {
                console.warn("Não foi possível enviar ping: conexão inativa");
                this._clearPingInterval();
            }
        }, 3000);
        
        console.log("Ping periódico iniciado - intervalo de 3 segundos");
    }

    /**
     * Limpa o intervalo de ping
     * @private
     */
    _clearPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Configura um timeout para verificar se a conexão está ativa
     * Se não receber nenhuma mensagem do servidor em 15 segundos, considera desconectado
     * @private
     */
    _setupConnectionTimeout() {
        this._clearConnectionTimeout();
        
        this.connectionHealthTimeout = setTimeout(() => {
            if (this.connected) {
                console.warn("Timeout de conexão atingido - Servidor não responde há 15 segundos");
                
                // Tenta reconectar automaticamente
                this._handleConnectionTimeout();
            }
        }, 15000); // 15 segundos sem resposta = desconexão
    }

    /**
     * Limpa o timeout de verificação de conexão
     * @private
     */
    _clearConnectionTimeout() {
        if (this.connectionHealthTimeout) {
            clearTimeout(this.connectionHealthTimeout);
            this.connectionHealthTimeout = null;
        }
    }

    /**
     * Reseta o timeout de conexão quando uma mensagem é recebida
     * @private
     */
    _resetConnectionTimeout() {
        // A cada mensagem recebida, reinicia o timer
        this._setupConnectionTimeout();
    }

    /**
     * Trata um timeout de conexão (servidor não responde)
     * @private
     */
    _handleConnectionTimeout() {
        console.error("Servidor não responde - considerando desconectado");
        
        // Atualiza estado interno
        this.connected = false;
        
        // Limpa recursos
        this._clearPingInterval();
        this._clearConnectionTimeout();
        
        // Notifica o usuário
        if (window.game && window.game.uiManager) {
            window.game.uiManager.showMessage("Conexão perdida com o servidor - timeout", 5000, "error");
            
            if (typeof window.game.uiManager.updateNetworkStatus === 'function') {
                window.game.uiManager.updateNetworkStatus(false);
            }
        }
        
        // Notifica o jogo
        if (this.onDisconnect) {
            this.onDisconnect("timeout");
        }
        
        // Tenta reconectar automaticamente
        if (this.serverUrl && window.game) {
            // Aguarda 2 segundos antes de tentar reconectar
            setTimeout(() => {
                if (window.game && window.game.uiManager) {
                    window.game.uiManager.showMessage("Tentando reconectar...", 3000, "info");
                }
                
                window.game.connectToMultiplayerServer(this.serverUrl, this.playerName)
                    .catch(err => {
                        console.error("Falha na reconexão automática:", err);
                    });
            }, 2000);
        }
    }

    /**
     * Manipula mensagens recebidas do servidor
     * @private
     * @param {MessageEvent} event - Evento de mensagem
     */
    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            const shouldLog = Math.random() < 0.05; // Log apenas 5% das mensagens
            
            if (data.type && shouldLog && 
                data.type !== 'update' && // Tipos comuns que não precisam ser logados sempre
                data.type !== 'pong' && 
                data.type !== 'ping') {
                console.log('Mensagem do servidor:', data);
            }
            
            // Reseta o contador de timeout de conexão a cada mensagem recebida
            this._resetConnectionTimeout();
            
            switch (data.type) {
                case 'connected':
                    console.log('Conexão confirmada pelo servidor, ID do jogador:', data.playerId);
                    this.playerId = data.playerId;
                    this.lastPingTime = null;
                    
                    // Iniciar ping periódico para medir latência
                    this._startPingInterval();
                    
                    // Solicitar lista de jogadores imediatamente após a conexão
                    this.requestPlayersList();
                    break;
                    
                case 'update':
                    this.processServerUpdate(data);
                    break;
                    
                case 'ping':
                    // Responde imediatamente ao ping do servidor com um pong
                    // IMPORTANTE: O servidor espera um pong em resposta aos seus pings
                    // Se não responder, o servidor desconecta o cliente
                    this._sendMessage('pong', { 
                        timestamp: data.timestamp,
                        clientTime: Date.now()
                    });
                    
                    // Log mais frequente para monitorar pings
                    console.log('Ping recebido do servidor e respondido com pong');
                    break;
                    
                case 'pong':
                    if (this.lastPingTime) {
                        const latency = Date.now() - this.lastPingTime;
                        // Reduzir logs de ping
                        if (Math.random() < 0.1) {
                            console.log(`Latência: ${latency}ms`);
                        }
                        this.latency = latency;
                        this.lastPingTime = null;
                        
                        // Atualizar contador de ping na UI
                        if (window.game && window.game.uiManager && 
                            typeof window.game.uiManager.updateNetworkStatus === 'function') {
                            window.game.uiManager.updateNetworkStatus(true, this.latency);
                        }
                    }
                    break;
                    
                case 'playerJoined':
                    console.log(`EVENTO: Jogador entrou: ${data.playerName || 'desconhecido'} (${data.playerId})`);
                    
                    // Atualizar o UI com mensagem sobre novo jogador
                    if (window.game && window.game.uiManager) {
                        window.game.uiManager.showMessage(`Jogador ${data.playerName || data.playerId} entrou no jogo!`, 3000, 'success');
                    }
                    
                    // Solicitar lista atualizada de jogadores
                    this.requestPlayersList();
                    break;
                    
                case 'playerLeft':
                    console.log(`EVENTO: Jogador saiu: ${data.playerId}`);
                    
                    // Remover jogador da cena
                    if (this.remotePlayers && this.remotePlayers.has(data.playerId)) {
                        // Notificar no UI
                        const player = this.remotePlayers.get(data.playerId);
                        if (window.game && window.game.uiManager) {
                            window.game.uiManager.showMessage(`Jogador ${player.name || data.playerId} saiu do jogo`, 3000, 'warning');
                        }
                        
                        // Remover o jogador remoto
                        this._removeRemotePlayer(data.playerId);
                    }
                    
                    // Solicitar lista atualizada de jogadores
                    this.requestPlayersList();
                    break;
                    
                case 'playersList':
                    if (data.players) {
                        console.log(`Recebida lista de jogadores: ${data.players.length} jogadores conectados`);
                        this._updatePlayersList(data.players);
                    } else {
                        console.warn('Recebida mensagem de lista de jogadores sem dados de jogadores');
                        this._updatePlayersList([]);
                    }
                    break;
                    
                case 'error':
                    console.error('Erro do servidor:', data.message);
                    if (window.game && window.game.uiManager) {
                        window.game.uiManager.showMessage(`Erro do servidor: ${data.message}`, 5000, 'error');
                    }
                    break;
                    
                default:
                    if (shouldLog) {
                        console.log('Tipo de mensagem desconhecido:', data.type);
                    }
            }
        } catch (e) {
            console.error('Erro ao processar mensagem do servidor:', e);
        }
    }

    /**
     * Atualiza a lista de jogadores remotos com base nos dados do servidor
     * @private
     * @param {Array} players - Lista de jogadores do servidor
     */
    _updatePlayersList(players) {
        try {
            if (!players || !Array.isArray(players)) {
                console.warn("Lista de jogadores inválida recebida do servidor");
                return;
            }
            
            console.log(`Recebida lista de ${players.length} jogadores do servidor`);
            
            // Conjunto de IDs de jogadores ativos no servidor
            const activePlayerIds = new Set(players.map(p => p.id));
            
            // Remove jogadores que não estão mais na lista do servidor
            if (this.remotePlayers) {
                for (const [id, player] of this.remotePlayers.entries()) {
                    if (!activePlayerIds.has(id) && id !== this.playerId) {
                        console.log(`Removendo jogador que não está mais no servidor: ${id}`);
                        this._removeRemotePlayer(id);
                    }
                }
            }
            
            // Processa cada jogador da lista
            players.forEach(playerData => {
                // Ignora o jogador local
                if (playerData.id === this.playerId) return;
                
                // Verifica se o jogador já existe
                if (this.remotePlayers && !this.remotePlayers.has(playerData.id)) {
                    console.log(`Adicionando jogador da lista: ${playerData.id}`);
                    this._createRemotePlayer(playerData.id, playerData);
                } else if (this.remotePlayers) {
                    // Atualiza dados do jogador existente
                    const remotePlayer = this.remotePlayers.get(playerData.id);
                    if (remotePlayer && typeof remotePlayer.updateFromNetworkData === 'function') {
                        remotePlayer.updateFromNetworkData(playerData);
                    }
                }
            });
            
            // Atualiza a UI
            this._updatePlayersUI();
            
            // Agenda próxima atualização da lista de jogadores
            this._schedulePlayerListUpdate();
        } catch (error) {
            console.error("Erro ao atualizar lista de jogadores:", error);
        }
    }

    /**
     * Atualiza a interface de usuário com a lista de jogadores atual
     * @private
     */
    _updatePlayersUI() {
        if (window.game && window.game.uiManager) {
            const playersList = [];
            
            // Adiciona o jogador local
            playersList.push({
                id: this.playerId || 'local',
                name: this.playerName || 'Você',
                latency: this.latency,
                isLocal: true
            });
            
            // Adiciona jogadores remotos
            if (this.remotePlayers) {
                this.remotePlayers.forEach((player, id) => {
                    playersList.push({
                        id,
                        name: player.name || `Jogador ${id}`,
                        latency: player.latency || 0,
                        isLocal: false
                    });
                });
            }
            
            if (typeof window.game.uiManager.updatePlayersList === 'function') {
                window.game.uiManager.updatePlayersList(playersList);
            }
        }
    }

    /**
     * Agenda uma atualização periódica da lista de jogadores
     * @private
     */
    _schedulePlayerListUpdate() {
        // Cancela qualquer timer existente
        if (this.playerListUpdateTimer) {
            clearTimeout(this.playerListUpdateTimer);
        }
        
        // Agenda próxima atualização em 5 segundos
        this.playerListUpdateTimer = setTimeout(() => {
            if (this.connected) {
                this.requestPlayersList();
            }
        }, 5000);
    }

    /**
     * Remove um jogador remoto
     * @private
     * @param {string} id - ID do jogador a remover
     */
    _removeRemotePlayer(id) {
        if (!this.remotePlayers) return;
        
        const remotePlayer = this.remotePlayers.get(id);
        if (!remotePlayer) return;
        
        // Remove o jogador da cena (se for um objeto RemotePlayer)
        if (remotePlayer.remove && typeof remotePlayer.remove === 'function') {
            remotePlayer.remove();
        }
        
        // Remove do mapa
        this.remotePlayers.delete(id);
        
        console.log(`NetworkManager: Jogador remoto removido [${id}]`);
        
        // Notifica a saída do jogador
        if (this.onPlayerLeft) {
            this.onPlayerLeft({id});
        }
    }

    /**
     * Cria ou atualiza projéteis remotos com base nos dados do servidor
     * @private
     * @param {Array} projectiles - Lista de projéteis do servidor
     */
    _updateRemoteProjectiles(projectiles) {
        if (!projectiles || !Array.isArray(projectiles)) return;
        
        // Conjunto de IDs de projéteis ativos
        const activeProjectileIds = new Set(projectiles.map(p => p.id));
        
        // Remove projéteis que não estão mais ativos
        if (this.remoteProjectiles) {
            for (const id of this.remoteProjectiles.keys()) {
                if (!activeProjectileIds.has(id)) {
                    // Remove o projétil
                    const projectile = this.remoteProjectiles.get(id);
                    if (projectile && projectile.remove) {
                        projectile.remove();
                    }
                    this.remoteProjectiles.delete(id);
                }
            }
        }
        
        // Atualiza ou cria novos projéteis
        projectiles.forEach(projectileData => {
            // Ignora projéteis do jogador local
            if (projectileData.ownerId === this.playerId) return;
            
            this._createOrUpdateRemoteProjectile(projectileData.id, projectileData);
        });
    }
} 