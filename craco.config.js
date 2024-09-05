// craco.config.js
module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Exclure des polyfills ou modules en utilisant resolve.fallback
      webpackConfig.resolve.fallback = {
        crypto: false,
		stream: false,
		http: false,
		https: false,
		zlib: false,
		url: false
        // Ajoutez d'autres modules à exclure si nécessaire
      };

      return webpackConfig;
    },
  },
};
