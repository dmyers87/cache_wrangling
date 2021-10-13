// Steve Hand  2021-OCT-13
// Utilities used in the scripts

/**
 * Right pad the provided string with the specified character
 * @param width
 * @param stringToPad
 * @param padLeft,
 * 		true add spaces on the left, or
 * 		false add space on the right
 * @return {*}
 */
function pad(width, stringToPad, padLeft=true) {
    assert(typeof width === "number", 'width arg must be number');

    if(stringToPad === 'undefined') {
        return "";
    }
    stringToPad = stringToPad.toString();

    let padded = "";
    if(width >= stringToPad.length) {
        if(padLeft) {
            padded = stringToPad.padStart(width);
        }
        else {
            padded = stringToPad.padEnd(width);
        }
    }
    else {
        padded = stringToPad.substring(0, width - 3) + '...';
    }
    return padded;
}

/**
 * @param n number to format
 * @return formatted string
 */
function niceNum(n) {
    assert(typeof n === "number", 'n arg must be number');
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * @param num number that is to be made 'human readable' and formatted
 * @return returns a formatted string
 */
function humanReadableNumber(num) {
    let aMB = Math.pow(1024, 2);
    let aGB = Math.pow(1024, 3);
    let rtnNum = "0";
    if(num > aGB) {
        rtnNum = niceNum(parseFloat((num/aGB).toFixed(2))) + " gb";
    }
    else if(num > aMB) {
        rtnNum = niceNum(parseFloat((num/aMB).toFixed(2))) + " mb";
    }
    else {
        rtnNum = niceNum(num) + "  b";
    }
    return rtnNum;
}
