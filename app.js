document.addEventListener('DOMContentLoaded', function() {
    const confirmBtn = document.getElementById('confirm-btn');
    const startBackdrop = document.getElementById('start-backdrop');
    const bgMusic = document.getElementById('bgMusic');
    const popupLayer = document.getElementById('popup-layer');
    let currentStageCleanup = null;

    confirmBtn.addEventListener('click', function() {
        startBackdrop.style.display = 'none';

        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {
            console.log('自动播放被阻止，需要用户交互');
        });

        if (typeof currentStageCleanup === 'function') {
            currentStageCleanup();
        }

        showGiftContent();
    });

    function showGiftContent() {
        popupLayer.innerHTML = '';

        const stage = document.createElement('div');
        stage.className = 'heart-stage';
        stage.innerHTML = `
      <div class="heart-instruction">蓝紫色的祝福即将抵达，请稍候...</div>
      <div class="heart-container"></div>
      <div class="heart-hint">提示：爱心完成后，轻触屏幕让祝福铺满整个冬夜</div>
    `;

        popupLayer.appendChild(stage);

        const container = stage.querySelector('.heart-container');
        const instruction = stage.querySelector('.heart-instruction');
        const hint = stage.querySelector('.heart-hint');

        const config = getPresentationConfig();
        const heartLayout = computeHeartLayout(config.tileCount);
        const blessings = generateBlessings(config.tileCount);
        const colors = generateTileColors(config.tileCount);
        const orderedBlessings = heartLayout.order.map(index => blessings[index]);
        const orderedColors = heartLayout.order.map(index => colors[index]);
        const tiles = createTiles(orderedBlessings, orderedColors, container);
        stage.dataset.layoutDensity = config.layoutDensity;

        let assembled = false;
        let flattened = false;

        setHeartContainerSize(container, config);
        positionTilesAsHeart(tiles, container, heartLayout, {
            animateFromScatter: true,
            baseDelay: config.baseDelay,
            stepDelay: config.stepDelay
        }, () => {
            assembled = true;
            instruction.textContent = '这颗心为你跳动，点击屏幕接受全部祝福';
            hint.textContent = '提示：轻触即可让祝福遍布每个角落';
        });

        const resizeHandler = () => {
            const latestConfig = getPresentationConfig();
            stage.dataset.layoutDensity = latestConfig.layoutDensity;
            if (!flattened) {
                setHeartContainerSize(container, latestConfig);
                positionTilesAsHeart(tiles, container, heartLayout, {
                    instant: true
                });
            } else {
                spreadTilesAcrossScreen(tiles, container);
            }
        };

        window.addEventListener('resize', resizeHandler);

        const cleanup = () => {
            window.removeEventListener('resize', resizeHandler);
        };

        currentStageCleanup = cleanup;

        stage.addEventListener('click', () => {
            if (!assembled) {
                return;
            }

            if (!flattened) {
                flattened = true;
                stage.classList.add('flattened');
                instruction.textContent = '冬夜已被祝福铺满，再次点击可重新开启礼物';
                hint.textContent = '提示：再点一次即可返回“确定”按钮';
                spreadTilesAcrossScreen(tiles, container);
            } else {
                cleanup();
                popupLayer.innerHTML = '';
                startBackdrop.style.display = 'flex';
            }
        });

        document.dispatchEvent(new Event('giftShown'));
    }

    function createTiles(texts, colors, container) {
        return texts.map((text, index) => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.textContent = text;
            tile.style.background = colors[index % colors.length];
            container.appendChild(tile);
            return tile;
        });
    }

    function setHeartContainerSize(container, config) {
        const baseWidth = window.innerWidth * config.widthRatio;
        const baseHeight = window.innerHeight * config.heightRatio;
        const width = Math.max(config.minWidth, Math.min(baseWidth, config.maxWidth));
        const height = Math.max(config.minHeight, Math.min(baseHeight, config.maxHeight));
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
    }

    function computeHeartLayout(count) {
        const rawPoints = [];
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < count; i++) {
            const t = Math.PI - (2 * Math.PI * i) / count;
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            rawPoints.push({ x, y });
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const sorted = rawPoints.map(({ x, y }, index) => {
            const adjustedX = x - centerX;
            const adjustedY = y - centerY;
            const angle = Math.atan2(adjustedY, adjustedX);
            return {
                x: adjustedX,
                y: adjustedY,
                angle,
                index
            };
        }).sort((a, b) => b.angle - a.angle);

        const points = sorted.map(({ x, y }) => ({ x, y }));
        const order = sorted.map(({ index }) => index);

        return {
            points,
            spanX: maxX - minX,
            spanY: maxY - minY,
            order
        };
    }

    function positionTilesAsHeart(tiles, container, layout, options = {}, onComplete) {
        if (!tiles.length) {
            return;
        }

        const { points, spanX, spanY } = layout;
        const {
            animateFromScatter = false,
            instant = false,
            baseDelay: providedBaseDelay,
            stepDelay: providedStepDelay
        } = options;

        const rect = container.getBoundingClientRect();
        const halfWidth = rect.width / 2;
        const halfHeight = rect.height / 2;
        const scaleFactor = Math.min((rect.width * 0.9) / spanX, (rect.height * 0.9) / spanY);

        const baseDelay = providedBaseDelay !== undefined ? providedBaseDelay : (animateFromScatter ? 240 : 20);
        const stepDelay = providedStepDelay !== undefined ? providedStepDelay : (instant ? 0 : 45);

        tiles.forEach((tile, index) => {
            const coord = points[index];
            const targetLeft = halfWidth + coord.x * scaleFactor;
            const targetTop = halfHeight - coord.y * scaleFactor;

            const applyTargetPosition = () => {
                tile.style.left = `${targetLeft}px`;
                tile.style.top = `${targetTop}px`;
                tile.classList.add('visible');
            };

            if (animateFromScatter) {
                const scatterLeft = Math.random() * rect.width;
                const scatterTop = Math.random() * rect.height;
                tile.classList.remove('visible');
                tile.style.transition = tile.style.transition || '';
                tile.style.left = `${scatterLeft}px`;
                tile.style.top = `${scatterTop}px`;
                tile.style.width = '';
                tile.style.height = '';
                setTimeout(applyTargetPosition, baseDelay + index * stepDelay);
            } else if (instant) {
                const previousTransition = tile.style.transition;
                tile.style.transition = 'none';
                tile.style.left = `${targetLeft}px`;
                tile.style.top = `${targetTop}px`;
                tile.classList.add('visible');
                void tile.offsetWidth;
                tile.style.transition = previousTransition;
            } else {
                setTimeout(applyTargetPosition, baseDelay + index * stepDelay);
            }
        });

        if (typeof onComplete === 'function') {
            if (instant) {
                onComplete();
            } else {
                const totalDelay = baseDelay + stepDelay * tiles.length + 800;
                setTimeout(onComplete, totalDelay);
            }
        }
    }

    function spreadTilesAcrossScreen(tiles, container) {
        const total = tiles.length;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        container.style.width = '100vw';
        container.style.height = '100vh';

        const aspectRatio = viewportWidth / viewportHeight;
        const columns = Math.ceil(Math.sqrt(total * aspectRatio));
        const rows = Math.ceil(total / columns);

        const usableWidth = viewportWidth * 0.88;
        const usableHeight = viewportHeight * 0.88;
        const cellWidth = usableWidth / columns;
        const cellHeight = usableHeight / rows;
        const tileSize = Math.min(120, Math.max(70, Math.min(cellWidth - 12, cellHeight - 12)));
        const startX = (viewportWidth - columns * cellWidth) / 2 + cellWidth / 2;
        const startY = (viewportHeight - rows * cellHeight) / 2 + cellHeight / 2;

        tiles.forEach((tile, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const targetLeft = startX + col * cellWidth;
            const targetTop = startY + row * cellHeight;

            tile.style.left = `${targetLeft}px`;
            tile.style.top = `${targetTop}px`;
            tile.style.width = `${tileSize}px`;
            tile.style.height = `${tileSize}px`;
            tile.classList.add('visible');
        });
    }

    function generateBlessings(count) {
        const basePhrases = [
            '愿你冬夜与光同眠',
            '愿你心底常留炭火',
            '愿你拥抱柔软时光',
            '愿你与好运撞个满怀',
            '愿你所念皆所愿',
            '愿你此刻自在闪耀',
            '愿你平安顺遂',
            '愿你保有赤子心',
            '愿你笑容永远灿烂',
            '愿你被世界温柔以待',
            '愿你与热爱长相伴',
            '愿你沉浸在甜蜜里',
            '愿你所有坚持都有回应',
            '愿你不惧风雪',
            '愿你眼中有星光',
            '愿你身旁有知己',
            '愿你如愿以偿',
            '愿你每天都闪闪发光',
            '愿你一路花开',
            '愿你心事都被照亮',
            ' 愿你步履不停，终见繁花 ',' 愿你历经山河，觉得人间值得 ',' 愿你日子清净，抬头所见皆温柔 ',' 愿你三冬暖，春不寒 ',' 愿你天黑有灯，下雨有伞 ',' 愿你一生被爱，勇敢自由 ',' 愿你所得皆所愿，所行皆坦途 ',' 愿你眼里有光，脚下有路 ',' 愿你走出半生，归来仍是少年 ',' 愿你付出甘之如饴，所得归于欢喜 ',' 愿你有盔甲，也有软肋 ',' 愿你有梦可追，有肩可依 ',' 愿你遍历人间，依然觉得生活可爱 ',' 愿你不慌不忙，向阳生长 ',' 愿你想要的都拥有，得不到的都释怀 ',' 愿你平安喜乐，万事胜意 ',' 愿你被生活温柔包裹，内心澄澈向暖 ',' 愿你如星辰，明亮不耀眼 ',' 愿你每个清晨都有新期待 ',' 愿你每个黄昏都有好回忆 ',' 愿你在鸡零狗碎里，找到闪闪的快乐 ',' 愿你对生活永远热忱，对未来永远憧憬 ',' 愿你拥有发现美的眼睛，捕捉暖的心灵 ',' 愿你前路漫漫，亦有可期 ',' 愿你穿过风雨，仍能拥抱彩虹 ',' 愿你珍惜当下，不负时光 ',' 愿你心有丘壑，眼存山河 ',' 愿你简单纯粹，自在随心 ',' 愿你被岁月温柔以待，不负韶华 ',' 愿你每个选择都坚定，每条路都值得 ',' 愿你把日子过成诗，浓淡皆宜 ',' 愿你有能力爱自己，有余力爱别人 ',' 愿你风雨中像个大人，阳光下像个孩子 ',' 愿你抬头遇晴空，低头拾美好 ',' 愿你一生努力，一生被爱 ',' 愿你平凡生活里，藏着生生不息的希望 ',' 愿你所有等待，都不被辜负 ',' 愿你所有美好，都如期而至 ',' 愿你心中有丘壑，立马振山河 ',' 愿你笑对生活，生活也笑对你 ',' 愿你历经千帆，归来仍是少年模样 ',' 愿你在薄情世界里，深情地活 ',' 愿你有说走就走的勇气，也有安稳停留的底气 ',' 愿你每个平凡的日子，都闪着不平凡的光 ',' 愿你所到之处，遍地阳光 ',' 愿你所行之路，皆遇坦途 ',' 愿你被这个世界温柔呵护，少些波澜 ',' 愿你保持热爱，奔赴下一场山海 ',' 愿你夜有好眠，昼有清欢 ',' 愿你日子有滋有味，生活有声有色 ',' 愿你不为往事忧，只为余生笑 ',' 愿你目光所及，皆是美好 ',' 愿你触手所及，皆是温暖 ',' 愿你在自己的节奏里，活得从容 ',' 愿你有足够的运气和勇气，遇见所有美好 ',' 愿你耕耘当下，收获未来 ',' 愿你心怀暖阳，不惧岁月寒凉 ',' 愿你把平凡的日子，过出自己的精彩 ',' 愿你有远方可奔赴，有过往可回头 ',' 愿你每次流泪，都是喜极而泣 ',' 愿你每次出发，都能平安抵达 ',' 愿你在喧嚣世界里，守得住内心的宁静 ',' 愿你有随时可以打扰的朋友，有永远牵挂的家人 ',' 愿你春赏百花秋望月，夏听蝉鸣冬观雪 ',' 愿你日子缓缓，余生漫漫，皆得所愿 ',' 愿你付出的每一份努力，都有双倍的回报 ',' 愿你在无人问津的日子里，也能独自绽放 ',' 愿你走过的弯路，都成为风景 ',' 愿你遇到的坎坷，都变成垫脚石 ',' 愿你心向阳光，何惧风霜 ',' 愿你温柔且坚定，知足且上进 ',' 愿你有能力拒绝所有不想要，有运气拥有所有想要的 ',' 愿你把生活嚼得有滋有味，把日子过得活色生香 ',' 愿你抬头可见月亮，低头可捡六便士 ',' 愿你被生活偏爱，好运常伴左右 ',' 愿你历经世事，依然保持善良与纯粹 ',' 愿你在疲惫生活中，总有温柔梦想 ',' 愿你每个今天，都比昨天更懂生活 ',' 愿你有勇气改变能改变的，有胸怀接受不能改变的 ',' 愿你眼中总有光芒，活成自己喜欢的模样 ',' 愿你三餐四季，温暖有趣 ',' 愿你岁岁常欢愉，年年皆胜意 ',' 愿你前路浩浩荡荡，万事皆可期待 ',' 愿你在薄情的世界里，深情地活成自己 ',' 愿你有盔甲抵御风浪，有软肋感知温柔 ',' 愿你遍历山河，觉得人间值得 ',' 愿你不辜负时光，不辜负自己 ',' 愿你在平凡的岗位上，做出不平凡的成绩 ',' 愿你有梦为马，随处可栖 ',' 愿你被很多人爱，如果没有，愿你在寂寞中学会宽容 ',' 愿你平安无疾，前程似锦 ',' 愿你天黑有灯，下雨有伞，路上有良人相伴 ',' 愿你眼中有星河，心中藏月光 ',' 愿你每天都有小确幸，累积成大幸福 ',' 愿你不为难自己，不辜负岁月 ',' 愿你活得通透，笑得坦荡 ',' 愿你所得过少时，不会终日愤愤 ',' 愿你所得过多时，不会终日惶恐 ',' 愿你有前进一寸的勇气，亦有后退一尺的从容 ',' 愿你一生清澈明朗，所求遂所愿 '
        ];

        const result = [];
        for (let i = 0; i < count; i++) {
            const phrase = basePhrases[i % basePhrases.length];
            result.push(`${phrase}`);
        }
        return result;
    }

    function generateTileColors(count) {
        const palette = [
            'linear-gradient(145deg, rgba(116, 225, 255, 0.95), rgba(137, 173, 255, 0.95))',
            'linear-gradient(145deg, rgba(181, 140, 255, 0.95), rgba(255, 170, 220, 0.95))',
            'linear-gradient(145deg, rgba(116, 255, 214, 0.95), rgba(144, 169, 255, 0.95))',
            'linear-gradient(145deg, rgba(255, 211, 173, 0.95), rgba(183, 153, 255, 0.95))',
            'linear-gradient(145deg, rgba(158, 255, 236, 0.95), rgba(227, 144, 255, 0.95))',
            'linear-gradient(145deg, rgba(126, 168, 255, 0.95), rgba(255, 176, 205, 0.95))',
            'linear-gradient(145deg, rgba(143, 255, 213, 0.95), rgba(255, 198, 255, 0.95))',
            'linear-gradient(145deg, rgba(114, 193, 255, 0.95), rgba(200, 139, 255, 0.95))',
            'linear-gradient(145deg, rgba(126, 255, 194, 0.95), rgba(130, 148, 255, 0.95))',
            'linear-gradient(145deg, rgba(255, 221, 178, 0.95), rgba(158, 125, 255, 0.95))'
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(palette[i % palette.length]);
        }
        return colors;
    }

    function getPresentationConfig() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const shortest = Math.min(width, height);

        if (shortest <= 520) {
            return {
                tileCount: 120,
                baseDelay: 140,
                stepDelay: 34,
                widthRatio: 0.9,
                heightRatio: 0.78,
                minWidth: 320,
                maxWidth: 640,
                minHeight: 320,
                maxHeight: 540,
                layoutDensity: 'compact'
            };
        }

        if (shortest <= 720) {
            return {
                tileCount: 150,
                baseDelay: 180,
                stepDelay: 40,
                widthRatio: 0.82,
                heightRatio: 0.75,
                minWidth: 360,
                maxWidth: 680,
                minHeight: 360,
                maxHeight: 580,
                layoutDensity: 'balanced'
            };
        }

        return {
            tileCount: 180,
            baseDelay: 220,
            stepDelay: 45,
            widthRatio: 0.75,
            heightRatio: 0.7,
            minWidth: 420,
            maxWidth: 760,
            minHeight: 420,
            maxHeight: 640,
            layoutDensity: 'airy'
        };
    }
});