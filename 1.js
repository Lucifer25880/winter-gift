// 可以添加一些特效，比如雪花动画
function createSnowflakes() {
    const snowContainer = document.createElement('div');
    snowContainer.className = 'snow-container';
    document.body.appendChild(snowContainer);

    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.innerHTML = '❄️';
            snowflake.className = 'snowflake';
            snowflake.style.left = Math.random() * 100 + 'vw';
            snowflake.style.animationDuration = (Math.random() * 3 + 2) + 's';
            snowflake.style.fontSize = (Math.random() * 10 + 10) + 'px';
            snowContainer.appendChild(snowflake);

            // 移除雪花
            setTimeout(() => {
                snowflake.remove();
            }, 5000);
        }, i * 200);
    }
}

// 在礼物展示时启动雪花效果
document.addEventListener('giftShown', createSnowflakes);