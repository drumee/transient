module.exports = {
	'signin_router': import('./widgets/router'),
	'signin_form': import('./widgets/form'),
	// Anonymous guest landing page. Registered here so it is reachable directly at
	// #/plugins?name=signin&kind=signin_guest, as well as through signin_router
	// (#/welcome/signin?view=guest).
	'signin_guest': import('./widgets/guest'),
};