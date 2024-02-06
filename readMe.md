# Requirement

Node v19.8.1
npm v9.5.1

# How to read

1. depositL1toL2: chuyển tiền từ mạng lưới ETH sang ZKSync. Hiện có 2 trường hợp là chuyển ETH và chuyển ERC20

- Thông thường thì tài khoản trên ZKSync và tài khoản trên ETH là giống nhau. Trừ khi có sự khác biệt thì người dùng phải có input tương ứng ở mục recipient trong file "1_inputFromClient.ts", không thì mặc định recipient == sender.

2. sendERC20L2: chuyển ERC20 trong mạng lưới ZKSync
3. sendNativeCoinL2: chuyển ETH trong mạng lưới ZKSync
4. withdrawL2toL1: chuyển tiền từ mạng lưới ZKSync sang ETH. Hiện có 2 trường hợp là chuyển ETH và chuyển ERC20. Riêng mục này sẽ cần 2 bước lớn.

- Bước 4.1 là thực hiện giao dịch withdraw trên ZKSync. Bước này sẽ trả về 1 hash of transaction
- Bước 4.2 là thực hiện giao dịch withdraw trên ETH với input là hash of transaction lấy được ở bước 4.1
- Người dùng sẽ phải kí lần lượt hai lần, tức sau khi kí bước 4.1 xong thì đợi lấy kết quả và kí tiếp bước 4.2
- Người dùng sau khi kí cả 2 bước thì cần đợi 1 ngày thì mới nhận được Coin/ Token trên nền tảng L1 (tức là ETH)
- Thông thường thì tài khoản trên ZKSync và tài khoản trên ETH là giống nhau. Trừ khi có sự khác biệt thì người dùng phải có input tương ứng ở mục recipient trong file "1_inputFromClient.ts", không thì mặc định recipient == sender.

5. generalpaymaster: user thực hiện 1 function của smart contract mà không mất phí trên nền tảng của ZKSync

- Cần phải deploy GeneralPayMaster và chuyển vào đó một ít ETH trên nền tảng của ZKSync
- Cần phải deploy một sample Smart Contract trên nền tảng của ZKSync
- User muốn tương tác với Smart Contract trên nền tảng của ZKSync đó thì cần thực hiện các bước trong folder tương ứng
