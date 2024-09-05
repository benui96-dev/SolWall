const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Ajouter le polyfill pour Buffer
      webpackConfig.resolve.fallback = {
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        buffer: require.resolve('buffer/') // Ajouter le polyfill pour Buffer
      };

      // Ajouter le plugin pour fournir Buffer globalement
      webpackConfig.plugins = (webpackConfig.plugins || []).concat([
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer']
        })
      ]);

      return webpackConfig;
    },
  },
};
