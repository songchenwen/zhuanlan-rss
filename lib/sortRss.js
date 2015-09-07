
var sortRss = function(items){
	items.sort(function(a, b){
		return new Date(b.date) - new Date(a.date);
	});
};

module.exports = sortRss;
