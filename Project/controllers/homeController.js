const Watchlist = require("../models/Watchlist");

exports.getHomePage = async (req, res) => {
  try {
    let watchlistMovies = [];
    let featuredMovie = null;

    if (req.session.userId) {
      const watchlistItems = await Watchlist.find({ userId: req.session.userId })
        .populate("movieId");

      watchlistMovies = watchlistItems
        .map(item => item.movieId)
        .filter(movie => movie);

      if (watchlistMovies.length > 0) {
        featuredMovie = watchlistMovies[0];
      }
    }

    res.render("home", {
      featuredMovie,
      watchlistMovies
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading home page.");
  }
};