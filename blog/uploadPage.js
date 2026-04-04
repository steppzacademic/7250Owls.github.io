import { alertPopups } from './main.js';

let imageCount = 0;

// Compress image to WebP
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

// Hash file (SHA-256)
async function hashFile(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

        <div class="editor-toolbar">
            <button type="button" id="add-image-btn">🖼 Insert Image</button>
        </div>

        <div id="editor" class="editor" contenteditable="true"></div>

        <button type="submit">Submit</button>
    </form>
    `;

    const editor = document.getElementById('editor');

    // Insert image button
    document.getElementById('add-image-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;

            try {
                // 1. Compress
                const compressed = await compressImage(file);

                // 2. Hash compressed version
                const hash = await hashFile(compressed);
                const fileName = `${hash}.webp`;

                let publicUrl;

                // 3. Check if exists
                const { data: existingFiles } = await supabase.storage
                    .from('images')
                    .list('', { search: fileName });

                if (existingFiles && existingFiles.length > 0) {
                    // ✅ Reuse existing
                    const { data } = supabase.storage
                        .from('images')
                        .getPublicUrl(fileName);

                    publicUrl = data.publicUrl;
                } else {
                    // 🚀 Upload new
                    const { error } = await supabase.storage
                        .from('images')
                        .upload(fileName, compressed, {
                            contentType: 'image/webp'
                        });

                    if (error) {
                        alertPopups("Upload failed: " + error.message);
                        return;
                    }

                    const { data } = supabase.storage
                        .from('images')
                        .getPublicUrl(fileName);

                    publicUrl = data.publicUrl;
                }

                // 4. Insert into editor
                insertImageAtCursor(publicUrl);

            } catch (err) {
                alertPopups("Image error: " + err.message);
            }
        };

        input.click();
    });

    function insertImageAtCursor(url) {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'post-image';

        const selection = window.getSelection();

        if (!selection.rangeCount) {
            editor.appendChild(img);
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);

        // Move cursor after image
        range.setStartAfter(img);
        range.setEndAfter(img);

        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Submit post
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alertPopups("Not logged in.");

        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle();

        const path = document.getElementById('blogPath').value;
        const title = document.getElementById('blogTitle').value;
        const genre = document.getElementById('blogGenre').value;

        const contentHTML = editor.innerHTML;

        if (!contentHTML.trim()) {
            return alertPopups("Post content cannot be empty.");
        }

        const { error } = await supabase
            .from('bloginfo')
            .insert([{
                blogPath: path,
                genre,
                blogData: {
                    PostName: title,
                    Post: contentHTML,
                    Author: profile.display_name,
                    Images: [] // no longer needed, but kept for compatibility
                }
            }]);

        if (error) {
            alertPopups("Upload Error: " + error.message);
        } else {
            window.location.hash = "";
        }
    });
}