export function remove<T>(haystack:T[], needle:T):boolean {
	var i = haystack.indexOf(needle);
	if (i > -1) {
		haystack.splice(i, 1);
		return true;
	}

	return false;
}
