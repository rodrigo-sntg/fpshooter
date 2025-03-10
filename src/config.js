/**
 * Constantes e configurações globais para o jogo Starstrike: Operação Zero
 * Todas as configurações estão centralizadas aqui para facilitar os ajustes e balanceamento
 */

// Configurações do jogador
export const PLAYER = {
    SPEED: 5,               // Velocidade de movimento do jogador
    HEALTH: 100,            // Saúde inicial do jogador
    JUMP_FORCE: 8,          // Força do pulo (se implementado)
    LOOK_SENSITIVITY: 0.2,  // Sensibilidade do mouse
    GRAVITY: 9.8,           // Gravidade aplicada ao jogador
    HEIGHT: 1.8,            // Altura do jogador em unidades
    RADIUS: 0.5,            // Raio do jogador para colisões
    STEP_HEIGHT: 0.35,      // Altura máxima que o jogador pode "subir" sem pular
    SPRINT_MULTIPLIER: 1.5, // Multiplicador de velocidade ao correr
};

// Configurações da arma
export const WEAPON = {
    DAMAGE: 25,             // Dano por tiro
    FIRE_RATE: 0.1,         // Segundos entre cada tiro (menor = mais rápido)
    RELOAD_TIME: 2,         // Tempo para recarregar em segundos
    RECOIL: 0.05,           // Quantidade de recuo ao disparar
    MAGAZINE_SIZE: 30,      // Tamanho do carregador
    MAX_AMMO: 90,           // Munição máxima reserva
    RANGE: 100,             // Alcance máximo do tiro
    BULLET_SPEED: 50,       // Velocidade do projétil
};

// Configurações do inimigo
export const ENEMY = {
    HEALTH: {
        BASIC: 50,          // Vida do inimigo básico
        MEDIUM: 100,        // Vida do inimigo médio
        HEAVY: 200          // Vida do inimigo pesado
    },
    SPEED: {
        BASIC: 2.5,         // Velocidade do inimigo básico
        MEDIUM: 2,          // Velocidade do inimigo médio
        HEAVY: 1.5          // Velocidade do inimigo pesado
    },
    DAMAGE: {
        BASIC: 10,          // Dano do inimigo básico
        MEDIUM: 15,         // Dano do inimigo médio
        HEAVY: 25           // Dano do inimigo pesado
    },
    SCORE: {
        BASIC: 100,         // Pontuação por matar inimigo básico
        MEDIUM: 250,        // Pontuação por matar inimigo médio
        HEAVY: 500          // Pontuação por matar inimigo pesado
    },
    ATTACK_RANGE: {
        BASIC: 3.0,         // Alcance de ataque do inimigo básico (aumentado)
        MEDIUM: 25,         // Alcance de ataque do inimigo médio (aumentado)
        HEAVY: 30           // Alcance de ataque do inimigo pesado (aumentado)
    },
    DETECTION_RADIUS: {
        BASIC: 30,          // Raio de detecção do inimigo básico (aumentado)
        MEDIUM: 35,         // Raio de detecção do inimigo médio (aumentado)
        HEAVY: 40           // Raio de detecção do inimigo pesado (aumentado)
    },
    ATTACK_COOLDOWN: {
        BASIC: 1.5,         // Tempo entre ataques do inimigo básico (reduzido)
        MEDIUM: 1.0,        // Tempo entre ataques do inimigo médio (reduzido)
        HEAVY: 2.0          // Tempo entre ataques do inimigo pesado (reduzido)
    }
};

// Configurações da onda
export const WAVE = {
    INITIAL_ENEMIES: 3,     // Número de inimigos na primeira onda
    ENEMIES_INCREMENT: 2,   // Incremento de inimigos por onda
    SPAWN_DELAY: 2,         // Segundos entre cada spawn de inimigo
    WAVE_DELAY: 5,          // Segundos entre cada onda
    MAX_ACTIVE_ENEMIES: 10, // Máximo de inimigos ativos simultaneamente
    BOSS_WAVES: [5, 10, 15] // Ondas em que chefes aparecerão
};

// Configurações dos itens e power-ups
export const ITEM = {
    HEALTH_PACK: {
        HEAL_AMOUNT: 50,    // Quantidade de saúde restaurada
        DURATION: 0,        // Duração do efeito (0 = instantâneo)
        RESPAWN_TIME: 60    // Tempo para reaparecer (em segundos)
    },
    SHIELD: {
        DURATION: 15,       // Duração do escudo em segundos
        DAMAGE_REDUCTION: 0.5 // Redução de dano (0-1, 0.5 = 50% menos dano)
    },
    AMMO_PACK: {
        AMMO_AMOUNT: 60,    // Quantidade de munição adicionada
        DURATION: 0         // Duração do efeito (0 = instantâneo)
    },
    RAPID_FIRE: {
        DURATION: 10,       // Duração do power-up em segundos
        FIRE_RATE_MULTIPLIER: 2 // Multiplicador da taxa de disparo
    }
};

// Configurações do jogo
export const GAME = {
    FPS_TARGET: 60,         // FPS alvo (para cálculos baseados em tempo)
    FOV: 75,                // Campo de visão da câmera
    NEAR_PLANE: 0.01,       // Plano próximo da câmera (ajustado para evitar clipping da arma)
    FAR_PLANE: 1000,        // Plano distante da câmera
    GRAVITY: 9.8,           // Gravidade do mundo
    AMBIENT_LIGHT: 0.5,     // Intensidade da luz ambiente (0-1)
    SAVE_INTERVAL: 30,      // Intervalo para salvar progresso (em segundos)
    DEBUG_MODE: true        // Ativar modo de depuração (mostra colisões, etc.)
};

// Configurações de áudio
export const AUDIO = {
    MUSIC_VOLUME: 0.5,      // Volume da música de fundo (0-1)
    SFX_VOLUME: 0.8,        // Volume dos efeitos sonoros (0-1)
    DISTANCE_MODEL: 'linear', // Modelo de atenuação de distância
    MAX_DISTANCE: 50,       // Distância máxima para ouvir um som
    REF_DISTANCE: 1         // Distância de referência para atenuação
};

// Adicionar seção de configurações de rede/multiplayer
export const NETWORK = {
    // URL padrão do servidor WebSocket
    DEFAULT_SERVER: 'ws://localhost:8080',
    
    // Taxa de atualização de rede (atualizações por segundo)
    UPDATE_RATE: 10,
    
    // Tempo máximo de ping (ms) antes de considerar conexão ruim
    MAX_PING: 150,
    
    // Limite de jogadores por sala/partida
    MAX_PLAYERS: 8,
    
    // Configurações de interpolação
    INTERPOLATION: {
        // Fator de interpolação (0-1)
        FACTOR: 0.2,
        
        // Atraso de interpolação (ms)
        DELAY: 100
    },
    
    // Limite de mensagens por segundo
    RATE_LIMIT: 30
}; 