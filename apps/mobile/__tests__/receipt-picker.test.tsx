import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ReceiptPicker } from '@/components/receipt-picker';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

const requestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('leaves the current selection unchanged when the system picker is cancelled', async () => {
  requestPermission.mockResolvedValue({ granted: true });
  launchLibrary.mockResolvedValue({ canceled: true, assets: null });
  const onChange = jest.fn();
  const screen = await render(<ReceiptPicker value={null} onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText('Choose a photo'));
  await waitFor(() => expect(launchLibrary).toHaveBeenCalledTimes(1));
  expect(onChange).not.toHaveBeenCalled();
});

it('returns a normalized selected image and reports permission denial', async () => {
  requestPermission.mockResolvedValueOnce({ granted: true });
  launchLibrary.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///receipt.png', mimeType: 'image/png', fileName: 'receipt.png', fileSize: 2048 }],
  });
  const onChange = jest.fn();
  const screen = await render(<ReceiptPicker value={null} onChange={onChange} />);
  await fireEvent.press(screen.getByLabelText('Choose a photo'));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({ uri: 'file:///receipt.png', name: 'receipt.png', mimeType: 'image/png' }));

  requestPermission.mockResolvedValueOnce({ granted: false });
  await fireEvent.press(screen.getByLabelText('Choose a photo'));
  expect(await screen.findByText('Allow photo access to attach a receipt.')).toBeTruthy();
});

it('exposes and enforces the disabled state while a receipt mutation is pending', async () => {
  const onChange = jest.fn();
  const screen = await render(<ReceiptPicker value={null} onChange={onChange} disabled />);
  const choose = screen.getByLabelText('Choose a photo');

  expect(choose).toBeDisabled();
  expect(choose.props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(choose);
  expect(requestPermission).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});
