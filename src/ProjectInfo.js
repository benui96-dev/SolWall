import { useState, useEffect } from 'react';

const ProjectInfo = () => {
    const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 768px)").matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 768px)");
        const handleResize = (e) => setIsMobile(e.matches);

        mediaQuery.addListener(handleResize);
        return () => mediaQuery.removeListener(handleResize);
    }, []);

    return (
        <><div className='project-info' style={{ marginTop: isMobile ? '50px' : '20px', textAlign: isMobile ? 'left' : 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                CA:
                <a href="https://solscan.io/token/B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                Project:
                <a href="https://whitepaper.solwall.live/sol-wall-project/user-guide" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>User guide</a>
                <a href="https://whitepaper.solwall.live" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>White paper</a>
                <a href="mailto:team@solwall.live" style={{ color: '#9945FF' }}>Contact</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                Social links:
                <a href="https://x.com/solwall_token" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Twitter</a>
                <a href="https://t.me/solwall_token" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Telegram</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                Buy on:
                <a href="https://jup.ag/swap/SOL-B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Jupiter</a>
                <a href="https://raydium.io/swap/?from=11111111111111111111111111111111&to=B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Raydium</a>
                <a href="https://www.orca.so/?outputCurrency=B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Orca</a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                Charts:
                <a href="https://www.dextools.io/app/en/solana/pair-explorer/B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Dextools</a>
                <a href="https://dexscreener.com/solana/B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Dexscreener</a>
                <a href="https://birdeye.so/token/B47jrQkyMsG7wEnri3iud4i5MQAaWQkgqTevrCU9Lj6R" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Birdeye</a>
            </div>
        </div>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'black',
                color: '#14F195',
                overflow: 'visible'
            }}>
                <div className="coinmarketcap-currency-widget" data-currencyid="5426" data-base="USD" data-secondary="" data-ticker="true" data-rank="true" data-marketcap="true" data-volume="true" data-statsticker="true" data-stats="USD"></div>
            </div></>
    );
};

export default ProjectInfo;
