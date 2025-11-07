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
            '愿你心事都被照亮',' 愿你岁岁常欢愉 ',' 愿你平安度四季 ',' 愿你笑口常打开 ',' 愿你前路皆坦途 ',' 愿你日子常晴朗 ',' 愿你好运总相随 ',' 愿你心暖无寒凉 ',' 愿你事事皆顺意 ',' 愿你每天都开心 ',' 愿你步步遇惊喜 ',' 愿你安稳度流年 ',' 愿你喜乐永相伴 ',' 愿你眼中常含光 ',' 愿你生活有甜味 ',' 愿你轻松过日常 ',' 愿你所求皆能得 ',' 愿你身边有温暖 ',' 愿你岁月皆温柔 ',' 愿你每天有小确幸 ',' 愿你旅途皆风景 ',' 愿你简单亦快乐 ',' 愿你平安又喜乐 ',' 愿你顺遂过一生 ',' 愿你每天都闪耀 ',' 愿你心宽万事轻 ',' 愿你时刻被偏爱 ',' 愿你好运挡不住 ',' 愿你日日是好日 ',' 愿你温暖不孤单 ',' 愿你梦想皆开花 ',' 愿你脚步皆从容 ',' 愿你生活常明媚 ',' 愿你遇事皆顺意 ',' 愿你笑容永不减 ',' 愿你岁岁皆安康 ',' 愿你前路有星光 ',' 愿你日常有诗意 ',' 愿你烦恼皆消散 ',' 愿你快乐不停歇 ',' 愿你日子有奔头 ',' 愿你处处遇良人 ',' 愿你四季皆安康 ',' 愿你心中常晴朗 ',' 愿你所求皆如愿 ',' 愿你生活少波澜 ',' 愿你每天有期盼 ',' 愿你前路多坦途 ',' 愿你时刻有力量 ',' 愿你温暖过四季 ',' 愿你喜乐长安宁 ',' 愿你简单又幸福 ',' 愿你日日有精进 ',' 愿你事事皆圆满 ',' 愿你平安无波澜 ',' 愿你笑容暖如阳 ',' 愿你好运常相伴 ',' 愿你生活有光芒 ',' 愿你岁岁无忧愁 ',' 愿你前路皆繁花 ',' 愿你日常有温暖 ',' 愿你快乐永相随 ',' 愿你事事都顺心 ',' 愿你日子常安宁 ',' 愿你心中有暖阳 ',' 愿你每天皆欢喜 ',' 愿你步步皆惊喜 ',' 愿你岁岁有今朝 ',' 愿你生活常喜乐 ',' 愿你前路有暖阳 ',' 愿你日常无烦忧 ',' 愿你梦想早实现 ',' 愿你脚步皆轻快 ',' 愿你生活常闪光 ',' 愿你遇事皆顺利 ',' 愿你笑容常灿烂 ',' 愿你岁岁皆健康 ',' 愿你前路有灯火 ',' 愿你日常有乐趣 ',' 愿你烦恼皆远去 ',' 愿你快乐永不停 ',' 愿你日子有盼头 ',' 愿你处处有真情 ',' 愿你四季皆平安 ',' 愿你心中常温暖 ',' 愿你所求皆所得 ',' 愿你生活少曲折 ',' 愿你每天有希望 ',' 愿你前路多美好 ',' 愿你时刻有勇气 ',' 愿你温暖伴一生 ',' 愿你喜乐常相伴 ',' 愿你简单且幸福 ',' 愿你日日有进步 ',' 愿你事事皆顺心 ',' 愿你平安常相伴 ',' 愿你笑容胜朝阳 ',' 愿你好运总不停 ',' 愿你生活有光彩 ',' 愿你岁岁无烦忧 ',' 愿你前路皆坦途 '
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