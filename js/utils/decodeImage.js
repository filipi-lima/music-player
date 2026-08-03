const decodeImage = (format, code) => {
    return `url(data:${format};base64,${window.btoa(code)})`;
};

export default decodeImage;
