import { alertPopups } from './main.js';

let imageCount = 0;

function renumberImages() {
    const rows = document.querySelectorAll('.image-input-row');
    rows.forEach((row, i) => {
        row.querySelector('.image-input-label').textContent = `Image ${i + 1}`;
    });
    imageCount = rows.length;
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 1200;
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

export async function pageLoad(supabase) {
    const container = document.getElementById('container');
    container.innerHTML = `
    <form class="upload-container" id="upload-form">
        <input type="text" id="blogPath" placeholder="Blog Path">
        <input type="text" id="blogTitle" placeholder="Blog Title">
        <select id="blogGenre">
            <option value="" disabled selected>Select Genre</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Electrical">Electrical</option>
            <option value="Programming">Programming</option>
            <option value="Business">Business</option>
            <option value="Community">Community</option>
            <option value="Competition">Competition</option>
            <option value="Other">Other</option>
        </select>
        <textarea id="blogContent" placeholder="Use [image1], [image2], etc. where images should appear."></textarea>
        <div id="image-inputs"></div>
        <button type="button" id="add-image-btn">+ Add Image</button>
        <button type="submit">Submit</button>
    </form>`;

    document.getElementById('add-image-btn').addEventListener('click', () => {
        imageCount++;
        const div = document.createElement('div');
        div.className = 'image-input-row';
        div.innerHTML = `
        <span class="image-input-label">Image ${imageCount}</span>
        <div class="image-input-controls">
            <label class="file-input-btn">
                Choose File
                <input type="file" class="blog-image-input" accept="image/*">
            </label>
            <span class="file-name-display">No file chosen</span>
            <button type="button" class="remove-image-btn">✕</button>
        </div>
        <img class="image-preview" style="display:none;">
        `;

        const fileInput = div.querySelector('.blog-image-input');
        const fileNameDisplay = div.querySelector('.file-name-display');
        const preview = div.querySelector('.image-preview');

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                preview.src = URL.createObjectURL(file);
                preview.style.display = 'block';
            }
        });

        div.querySelector('.remove-image-btn').addEventListener('click', () => {
            div.remove();
            renumberImages();
        });

        document.getElementById('image-inputs').appendChild(div);
    });

    document.getElementById('upload-form').addEventListener('submit', (e) => {
        e.preventDefault();
        uploadData(supabase);
    });
}

async function uploadData(supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alertPopups("Not logged in.");

    const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

    const path = document.getElementById('blogPath').value;
    const title = document.getElementById('blogTitle').value;
    const content = document.getElementById('blogContent').value;
    const genre = document.getElementById('blogGenre').value;

    const imageFiles = document.querySelectorAll('.blog-image-input');
    const imageUrls = [];

    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i].files[0];
        if (!file) return alertPopups(`Image ${i + 1} missing.`);

        const compressed = await compressImage(file);
        const fileName = `${path}-${Date.now()}-${i}.webp`;

        await supabase.storage.from('images').upload(fileName, compressed);
        const { data } = supabase.storage.from('images').getPublicUrl(fileName);

        imageUrls.push(data.publicUrl);
    }

    // ✅ FIXED VALIDATION
    const markers = content.match(/\[image\s*\d+\s*\]/gi) || [];

    if (markers.length !== imageUrls.length) {
        return alertPopups(
            `You have ${markers.length} image markers but ${imageUrls.length} images.`
        );
    }

    await supabase.from('bloginfo').insert([{
        blogPath: path,
        genre,
        blogData: {
            PostName: title,
            Post: content,
            Author: profile.display_name,
            Images: imageUrls
        }
    }]);

    window.location.hash = "";
}